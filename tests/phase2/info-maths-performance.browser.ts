import { test, expect } from "@playwright/test";
import { MongoClient } from "mongodb";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { InfoCardRepository } from "../../src/lib/infoCards/repository";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";

// Identical disposable-host benchmark before/after the publication change.
// No real account, deployment or database is used. Transaction instrumentation
// is confined to this test's repository instance, not production code.
test("publication timing: flush, API, transaction and click-to-success", async ({ page }) => {
  test.setTimeout(180000);
  assertDisposableDatabase();
  const report: { mode: string; ui: unknown[]; repository: unknown[] } = { mode: "after", ui: [], repository: [] };
  await page.request.post("/api/auth/login", { data: { identifier: "phase2", password: "local-test-only" } });
  for (let i = 0; i < 3; i++) {
    await page.goto("/creator/info-cards/new");
    await page.getByRole("combobox", { name: "Series", exact: true }).selectOption("demo-series-owner");
    await page.getByRole("textbox", { name: "Title", exact: true }).fill("Maths timing");
    await expect(page).toHaveURL(/\/creator\/info-cards\/[a-f\d-]+/);
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();
    const id = new URL(page.url()).pathname.split("/").at(-1)!;
    let requestAt = 0, saveRequestAt = 0, saveResponseAt = 0;
    const onRequest = (request: import("@playwright/test").Request) => {
      if (request.url().endsWith(`/api/info-cards/${id}/publish`)) requestAt = performance.now();
      if (request.url().endsWith(`/api/info-cards/${id}`) && request.method() === "PATCH") saveRequestAt = performance.now();
    };
    const onResponse = (response: import("@playwright/test").Response) => { if (response.url().endsWith(`/api/info-cards/${id}`) && response.request().method() === "PATCH") saveResponseAt = performance.now(); };
    page.on("response", onResponse);
    page.on("request", onRequest);
    await page.getByRole("textbox", { name: "Explanation", exact: true }).fill(String.raw`General rule: $x=\frac{12}{3}=4$`);
    const response = page.waitForResponse(r => r.url().endsWith(`/api/info-cards/${id}/publish`) && r.request().method() === "POST");
    const clickedAt = performance.now();
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    const published = await response, responseAt = performance.now();
    expect(published.status()).toBe(200);
    await expect(page.getByRole("button", { name: "Published", exact: true })).toBeVisible();
    report.ui.push({ sample: i + 1, draftSaveApiMs: saveResponseAt - saveRequestAt, flushUntilPublishRequestMs: requestAt - clickedAt, publicationApiMs: responseAt - requestAt, clickToSuccessMs: performance.now() - clickedAt });
    page.off("request", onRequest); page.off("response", onResponse);
  }
  const client = await new MongoClient(process.env.MONGODB_URI!).connect();
  try {
    const repo = new InfoCardRepository(client.db(process.env.MONGODB_DB!), client), actor = process.env.PHASE2_USER_ID!;
    const original = repo.transaction.bind(repo);
    let transactionMs = 0;
    repo.transaction = async run => { const start = performance.now(); try { return await original(run); } finally { transactionMs += performance.now() - start; } };
    for (const kind of ["maths", "plain"] as const) for (let i = 0; i < 3; i++) {
      const id = randomUUID(); await repo.create(actor, id);
      await repo.save(actor, id, 0, { title: "Timing", body: kind === "maths" ? "$x=4$" : "Divide by three.", ...(kind === "maths" ? { bodyFormat: "latex-v1" as const } : {}), seriesId: "demo-series-owner", mediaItem: null }, "private");
      transactionMs = 0; const start = performance.now();
      await repo.publish(actor, id, 1);
      report.repository.push({ kind, sample: i + 1, publicationMs: performance.now() - start, databaseTransactionMs: transactionMs });
    }
  } finally { await client.close(); }
  const output = process.env.INFO_MATHS_BENCHMARK_OUTPUT ?? "/tmp/switchplay-maths-publication-after.json";
  await writeFile(output, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
});

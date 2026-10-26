import { expect, test, chromium, firefox, webkit } from "@playwright/test";
import { readFileSync } from "node:fs";
import { mathsHostToken } from "../../src/lib/infoCards/mathsHostAuth";
import { MongoClient } from "mongodb";
import { randomUUID } from "node:crypto";
import { CardRepository } from "../../src/lib/cards/repository";
import { InfoCardRepository } from "../../src/lib/infoCards/repository";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";
import { createDefaultCardContent, createDefaultDeckContent } from "../../src/lib/cards/creatorDefaults";
const explanationReviews = [...readFileSync("src/app/dev/maths-renderer/ExplanationReviewFixtures.tsx", "utf8").matchAll(/content:\s*String\.raw`([^`]+)`/g)].map(match => ({ content: match[1] }));

test("real editor autosaves exact maths, trusted Chromium publishes, Library and consultation retain the format", async ({ page, request, browser }) => {
  await page.request.post("/api/auth/login", { data: { identifier: "phase2", password: "local-test-only" } });
  expect((await request.get("/internal/info-maths")).status()).toBe(404);
  await page.goto("/creator/info-cards/new");
  await page.getByRole("combobox", { name: "Series", exact: true }).selectOption({ label: "Basics (phase2)" });
  await page.getByRole("textbox", { name: "Title", exact: true }).fill("Maths");
  const input = page.getByRole("textbox", { name: "Explanation", exact: true });
  for (const source of explanationReviews) {
    await input.fill(source.content);
    await expect(page.getByText("Explanation fits.", { exact: true })).toBeVisible();
    await expect(page.locator("[data-maths-renderer] .katex").first()).toBeVisible();
    expect(await input.inputValue()).toBe(source.content);
    const geometry = await page.locator("[data-info-card-face]").evaluate(el => ({ width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height, padding: getComputedStyle(el).padding }));
    expect(geometry).toEqual({ width: 240, height: 204, padding: "12px" });
  }
  const source = explanationReviews[2].content;
  await input.fill(source); await expect(page.getByText("Explanation fits.", { exact: true })).toBeVisible();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  const id = new URL(page.url()).pathname.split("/").at(-1)!;
  const saved = await (await page.request.get(`/api/info-cards/${id}`)).json();
  expect(saved.root.draft.body).toBe(source); expect(saved.root.draft.bodyFormat).toBe("latex-v1");
  expect((await page.request.post(`/api/info-cards/${id}/publish`, { data: { revision: saved.root.revision, fits: true } })).status()).toBe(400);
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByRole("button", { name: "Published", exact: true })).toBeVisible({ timeout: 45000 });
  const published = await (await page.request.get(`/api/info-cards/${id}`)).json();
  expect(published.publication.mathsValidation).toEqual({ version: 1 }); expect(published.publication.content.body).toBe(source);
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await expect(page.locator(`[data-info-id='${id}'] [data-maths-renderer] .katex`).first()).toBeVisible();
  await page.locator(`[data-info-id='${id}'] [data-info-card-face]`).screenshot({ path: "tests/info-maths/evidence/library-maths.png" });
  const snapshot = await (await page.request.get(`/api/info-cards/${id}/publication`)).json();
  expect(snapshot.content.body).toBe(source); expect(snapshot.content.bodyFormat).toBe("latex-v1");
  // Real main/deck publications exercise learner reads, physical stack scaling
  // and navigation between maths and legacy cards, without another validation.
  assertDisposableDatabase(); const client = await new MongoClient(process.env.MONGODB_URI!).connect();
  let deckId: string;
  try {
    const main = new CardRepository(client.db(process.env.MONGODB_DB!), client), owner = process.env.PHASE2_USER_ID!;
    await new InfoCardRepository(main.db, client).assertIndexesReady(true);
    const card = await main.createCardDraft(owner, { ...createDefaultCardContent([randomUUID(), randomUUID(), randomUUID()]), infoCardIds: [id, "demo-owner-public"],
      intro: { title: "Maths practice", description: "Main instruction remains mounted", mediaItem: null },
      steps: [0, 1, 2].map(index => ({ stepId: randomUUID(), title: `Practice ${index + 1}`, description: "Keep working.", mediaItem: null })) }, "private");
    await main.publishCard(owner, card.cardTemplateId, 0);
    const deck = await main.createDeckDraft(owner, { ...createDefaultDeckContent([]), title: "Maths integration", cards: [{ cardTemplateId: card.cardTemplateId }] }, "private");
    await main.publishDeck(owner, deck.deckTemplateId, 0); deckId = deck.deckTemplateId;
    await main.ensureDeckData(owner, deckId, 1); await main.ensureCardData(owner, card.cardTemplateId, 1);
  } finally { await client.close(); }
  await page.goto(`/decks?openDeck=${deckId}`); await page.locator(".deck-card.is-active").press("Enter");
  await page.locator(".focused-card-layer .active-card-identity").click();
  await page.getByRole("button", { name: /^Open information cards/ }).click();
  const stack = page.locator("[data-info-card-stack]"); await expect(stack).toHaveAttribute("data-info-stack-phase", "open");
  await expect(page.locator('[data-info-card-current="true"] [data-maths-renderer] .katex').first()).toBeVisible();
  await expect(stack.getByRole("alert")).toHaveCount(0);
  await stack.screenshot({ path: "tests/info-maths/evidence/consultation-maths.png" });
  await page.keyboard.press("ArrowDown"); await expect(page.locator('[data-info-card-current="true"]')).toHaveAttribute("data-info-card-id", "demo-owner-public");
  await page.keyboard.press("ArrowUp"); await expect(page.locator('[data-info-card-current="true"]')).toHaveAttribute("data-info-card-id", id);
  await expect(stack).toHaveAttribute("data-info-stack-phase", "open"); await expect(stack.getByRole("alert")).toHaveCount(0);
  await page.getByRole("button", { name: "Close information card stack", exact: true }).click();
  const deniedContext = await browser.newContext({ storageState: await page.context().storageState() });
  try {
    const denied = await deniedContext.newPage(); await denied.route(/\.(woff2?|ttf)(\?|$)/, route => route.abort());
    await denied.goto(new URL("/library?tab=info-cards", page.url()).href);
    await expect(denied.locator(`[data-info-id='${id}']`).getByRole("alert")).toHaveText("The explanation fonts could not load. Reload to try again.");
  } finally { await deniedContext.close(); }
  // Invalid input remains saved and cannot be published via direct API.
  await page.goto(`/creator/info-cards/${id}`); await input.fill("Before $$\\frac{1}{2}");
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  const invalid = await (await page.request.get(`/api/info-cards/${id}`)).json();
  const failure = await page.request.post(`/api/info-cards/${id}/publish`, { data: { revision: invalid.root.revision }, timeout: 45000 });
  expect(failure.status()).toBe(422); expect((await failure.json()).error).toBe("INFO_MATHS_INVALID");
});

for (const browserName of ["chromium", "firefox", "webkit"] as const) test(`real shared maths face · ${browserName}: media, padding and physical overflow`, async () => {
  const browser = await ({ chromium, firefox, webkit })[browserName].launch();
  const page = await browser.newPage({ baseURL: process.env.PHASE2_BASE_URL });
  try {
    await page.setExtraHTTPHeaders({ "x-info-maths-host": mathsHostToken() });
    await page.goto("/internal/info-maths"); await page.waitForFunction(() => !!window.infoMaths);
    for (const mediaKind of [undefined, "image"] as const) for (const sample of explanationReviews) {
      await page.evaluate(card => window.infoMaths!.mount(card), { title: "Maths", seriesTitle: "Basics", seriesCreatorUsername: "", bodyFormat: "latex-v1" as const, body: sample.content, mediaKind });
      await page.waitForFunction(() => window.infoMaths?.current?.result.status === "ready");
      const measured = await page.evaluate(() => window.infoMaths!.current!);
      expect(measured.safe).toBe(true); expect(measured.headerFits).toBe(true);
      const box = await page.locator("[data-info-card-face]").evaluate(el => ({ height: el.getBoundingClientRect().height, padding: getComputedStyle(el).padding, width: el.querySelector("[data-info-card-body]")!.getBoundingClientRect().width }));
      expect(box).toEqual({ height: 204, padding: "12px", width: 214 });
      expect(await page.locator(".katex-error").count()).toBe(0);
    }
    // Existing bottom padding absorbs overflow, then the physical boundary
    // rejects additional lines. Engines have different actual line metrics.
    let borrowedPadding = false, physicallyUnsafe = false;
    for (const lines of [14, 15, 16, 17, 18]) {
      await page.evaluate(body => window.infoMaths!.mount({ title: "Maths", seriesTitle: "Basics", seriesCreatorUsername: "", bodyFormat: "latex-v1", body }), Array(lines).fill("Line").join("\n"));
      await page.waitForFunction(() => window.infoMaths?.current?.result.status === "ready");
      const measured = await page.evaluate(() => window.infoMaths!.current!);
      expect(measured.result.status).toBe("ready");
      borrowedPadding ||= measured.result.status === "ready" && measured.result.layout.overflowY && measured.safe;
      physicallyUnsafe ||= !measured.safe;
    }
    expect(borrowedPadding).toBe(true); expect(physicallyUnsafe).toBe(true);
    await page.evaluate(() => window.infoMaths!.mount({ title: "Maths", seriesTitle: "Basics", seriesCreatorUsername: "", bodyFormat: "latex-v1", body: "$$\\rule{400px}{1px}$$" }));
    await page.waitForFunction(() => window.infoMaths?.current?.result.status === "ready");
    expect((await page.evaluate(() => window.infoMaths!.current!)).safe).toBe(false);
    // Legacy currency/backslashes are literal; no mathematical parser is mounted.
    await page.evaluate(() => window.infoMaths!.mount({ title: "Legacy", seriesTitle: "Basics", seriesCreatorUsername: "", body: "$5 and $10; \\frac{1}{2}" }));
    await expect(page.locator("[data-info-card-body]")).toHaveText("$5 and $10; \\frac{1}{2}");
    await expect(page.locator("[data-maths-renderer]")).toHaveCount(0);
  } finally { await browser.close(); }
});

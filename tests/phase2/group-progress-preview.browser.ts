import { expect, test, chromium, webkit, type Page } from "@playwright/test";
import { MongoClient } from "mongodb";
import { groupProgressFixture, projectGroupProgressFixture } from "../fixtures/groupProgress";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";
import { metrics, followerMetrics } from "../../src/lib/groupExperiences/readModels";

const preview = process.env.PHASE5_PROGRESS_PREVIEW_URL;
test.skip(!preview, "Requires --group-progress in the isolated runner");
const itemRow = (page: Page, id: string) => page.locator(`tr[data-item-id="${id}"]`);

for (const engine of ["chromium", "webkit"] as const) {
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    test(`fixture Group Progress uses real hierarchy, metrics and read-only histories: ${engine} ${viewport.width}`, async () => {
      const browser = await (engine === "webkit" ? webkit : chromium).launch();
      try {
        const page = await browser.newPage({ viewport, ...(engine === "webkit" && viewport.width === 390 ? { isMobile: true, hasTouch: true } : {}) });
        const errors: string[] = [], personalRequests: string[] = [];
        page.on("pageerror", error => errors.push(error.message));
        page.on("request", request => { if (new URL(request.url()).pathname.startsWith("/api/")) personalRequests.push(request.url()); });
        await page.goto(`${preview}/__group-progress-preview`);
        await expect(page.getByRole("heading", { name: "My Progress", exact: true })).toBeVisible();
        await expect(page.getByLabel("Framework", { exact: true })).toHaveValue("galway-progress-review");
        await expect(page.locator("tr[data-area-id]")).toHaveCount(3);
        await expect(page.locator("tr[data-item-id]")).toHaveCount(9);
        const expected = projectGroupProgressFixture(groupProgressFixture()).summary;
        for (const area of expected.areas) {
          const areaRow = page.locator(`tr[data-area-id="${area.id}"]`);
          await expect(areaRow.locator("td").nth(0)).toHaveText(`${area.progress.completion}%`);
          await expect(areaRow.locator("td").nth(1)).toHaveText(String(area.progress.confidence));
          for (const item of area.items) {
            const row = itemRow(page, item.id);
            await expect(row.locator("td").nth(0)).toHaveText(`${item.progress.completion}%`);
            await expect(row.locator("td").nth(1)).toHaveText(String(item.progress.confidence));
            await expect(row.locator(".assessment-pass, .assessment-fail")).toHaveCount(3);
          }
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        await page.getByRole("button", { name: "Collapse Movement", exact: true }).click();
        await expect(itemRow(page, "review-item-1-1")).toBeHidden();
        await page.reload();
        await expect(page.getByRole("button", { name: "Expand Movement", exact: true })).toBeVisible();
        await page.getByRole("button", { name: "Expand Movement", exact: true }).click();
        await itemRow(page, "review-item-1-1").locator(".progress-tests-trigger").click();
        const modal = page.getByRole("dialog", { name: "Assessment history", exact: true });
        await expect(modal).toBeVisible();
        await expect(modal.locator("tbody tr")).toHaveCount(7);
        await expect(modal.getByText("Progress", { exact: true })).toHaveCount(3);
        await expect(modal.getByText("Find a steady base", { exact: true })).toHaveCount(2);
        await expect(modal.getByText("Control the movement", { exact: true })).toHaveCount(2);
        await expect(modal.getByRole("button", { name: "Add test", exact: true })).toBeDisabled();
        for (const action of await modal.getByRole("button", { name: /^(Edit|Delete) test/ }).all()) await expect(action).toBeDisabled();
        await expect(modal).not.toContainText("PRIVATE-progress-test");
        await modal.getByRole("button", { name: "Close", exact: true }).click();
        await expect(modal).toHaveCount(0);
        expect(personalRequests).toEqual([]);
        expect(errors).toEqual([]);
        await page.screenshot({ path: `phase2-test-results/group-progress-${engine}-${viewport.width}.png`, fullPage: true });
      } finally { await browser.close(); }
    });
  }
}

test("preview uses real disposable Group learning and never stores Group assessment fixtures in Mongo", async ({ page }) => {
  assertDisposableDatabase();
  const client = await new MongoClient(process.env.MONGODB_URI!).connect();
  try {
    const db = client.db(process.env.MONGODB_DB!), experienceId = process.env.PHASE5_PROGRESS_EXPERIENCE!;
    const experience = await db.collection("groupExperiences").findOne({ experienceId });
    expect(experience).not.toBeNull(); expect(experience).not.toHaveProperty("itemTests");
    const states = await db.collection("groupCardData").find({ experienceId }).toArray();
    expect(states).toHaveLength(12); expect(states.every(state => !Object.hasOwn(state, "tests"))).toBe(true);
    expect(await db.collection("users").countDocuments({ "cardsData.tests.id": /^PRIVATE-progress-test-/ })).toBe(4);
    expect((await page.request.post("/api/auth/login", { data: { identifier: "phase2", password: "local-test-only" } })).status()).toBe(200);
    const response = await page.request.get(`/api/group-experiences/${experienceId}/summary`);
    expect(response.status()).toBe(200);
    const actual = await response.json(), fixture = groupProgressFixture();
    expect(actual.group).toEqual(metrics(fixture.cards.map(card => card.learning)));
    expect(actual.followers).toEqual(followerMetrics(fixture.followerLearning));
    expect(JSON.stringify(actual)).not.toContain("PRIVATE-progress-test");
    const before = JSON.stringify(states);
    await page.goto(`${preview}/__group-progress-preview`);
    await expect(page.locator("tr[data-item-id]")).toHaveCount(9);
    expect(JSON.stringify(await db.collection("groupCardData").find({ experienceId }).toArray())).toBe(before);
    const group = await page.evaluate(() => (window as unknown as { groupProgressPreview: { summary: unknown } }).groupProgressPreview.summary);
    expect(JSON.stringify(group)).not.toContain("PRIVATE-progress-test");
    expect(await (await page.request.get(`${preview}/api/items-data/review-item-1-1/history`)).status()).toBe(404);
    expect(await (await page.request.post(`${preview}/api/items-data/review-item-1-1/tests`, { data: {} })).status()).toBe(404);
  } finally { await client.close(); }
});

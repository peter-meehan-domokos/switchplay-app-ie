import { expect, test, type Page } from "@playwright/test";
import { MongoClient, ObjectId } from "mongodb";
import { randomUUID } from "node:crypto";
import { hashSync } from "bcryptjs";
import { CardRepository } from "../../src/lib/cards/repository";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";
import { cardFixture, deckFixture } from "../fixtures/frameworks";
import { itemFixtureRoutes } from "./helpers/assessmentFixtureRoutes";
import { readFrameworkSummary } from "../../src/lib/frameworks/readModels";
import type { Framework } from "../../src/lib/frameworks/configuration";

const modal = (page: Page) => page.getByRole("dialog", { name: "Assessment history", exact: true });
const row = (page: Page, id: string) => page.locator(`tr[data-item-id="${id}"]`);
async function fixture(page: Page) {
  assertDisposableDatabase();
  const client = await new MongoClient(process.env.MONGODB_URI!).connect(), repo = new CardRepository(client.db(process.env.MONGODB_DB!), client);
  const actor = new ObjectId(), username = `progress-${randomUUID()}`;
  const source = cardFixture(randomUUID()), fork = cardFixture(randomUUID(), source.root.cardTemplateId), zero = cardFixture(randomUUID()), skipped = cardFixture(randomUUID()), missing = cardFixture(randomUUID()), orphan = cardFixture(randomUUID());
  const cards = [source, fork, zero, skipped, missing, orphan];
  for (const card of cards) card.root.ownerUserId = actor.toHexString();
  source.version.content.intro.title = "Original algebra practice";
  fork.version.content.intro.title = "Personal algebra practice";
  source.data.tests = [{ id: randomUUID(), date: "2026-10-10", result: true, createdAt: new Date("2026-10-10T10:00:00Z") }];
  fork.data.tests = [{ id: randomUUID(), date: "2026-10-11", result: false, createdAt: new Date("2026-10-11T10:00:00Z") }];
  fork.data.historySourceCardTemplateId = source.root.cardTemplateId;
  fork.data.items[0].completionStatus = "done";
  fork.data.signalReadings[0].reading = 7.2; fork.data.signalReadings[1].reading = 8.2;
  skipped.data.items.forEach((step) => { step.completionStatus = "skipped"; }); skipped.data.signalReadings[0].reading = 4;
  missing.data.historySourceCardTemplateId = randomUUID();
  missing.data.tests = [{ id: randomUUID(), date: "2026-10-13", result: true, createdAt: new Date() }];
  const active = deckFixture(randomUUID(), [fork.root.cardTemplateId, zero.root.cardTemplateId, skipped.root.cardTemplateId, missing.root.cardTemplateId]);
  const archived = deckFixture(randomUUID(), [fork.root.cardTemplateId], true);
  for (const deck of [active, archived]) deck.root.ownerUserId = actor.toHexString();
  const user = { _id: actor, username, email: `${username}@example.invalid`, passwordHash: hashSync("local-test-only", 4),
    cardsData: cards.map((card) => card.data), decksData: [active.data, archived.data], itemTests: [], itemTestsRevision: 0, createdAt: new Date(), updatedAt: new Date() };
  await repo.users().insertOne(user); await repo.cards().insertMany(cards.map((card) => card.root));
  await repo.cardVersions().insertMany(cards.filter((card) => card !== missing).map((card) => card.version));
  await repo.decks().insertMany([active.root, archived.root]); await repo.deckVersions().insertMany([active.version, archived.version]);
  const frameworks: Framework[] = [{ id: "practice", title: "Practice Framework", areas: [
    { id: "skills", title: "Algebra", items: [
      { id: "control", title: "Control of algebraic expressions with a deliberately long title", cardTemplateIds: [source.root.cardTemplateId] },
      { id: "zero", title: "Unfinished practice", cardTemplateIds: [zero.root.cardTemplateId] },
      { id: "skipped", title: "Skipped practice", cardTemplateIds: [skipped.root.cardTemplateId] },
      { id: "direct", title: "Direct assessments", cardTemplateIds: [] },
      { id: "partial", title: "Unavailable practice", cardTemplateIds: [missing.root.cardTemplateId] }] },
    { id: "other-area", title: "Calculus", items: [{ id: "other-item", title: "No eligible work", cardTemplateIds: [orphan.root.cardTemplateId] }] },
    { id: "empty-area", title: "Trigonometry", items: [] }] },
  { id: "alternative", title: "Alternative Framework", areas: [{ id: "skills", title: "Alternative Area", items: [{ id: "alternative-item", title: "Alternative goal", cardTemplateIds: [source.root.cardTemplateId] }] }] },
  { id: "empty-framework", title: "Empty Framework", areas: [] }];
  expect((await page.request.post("/api/auth/login", { data: { identifier: username, password: "local-test-only" } })).status()).toBe(200);
  await itemFixtureRoutes(page, repo, actor.toHexString(), frameworks);
  return { client, repo, actor: actor.toHexString(), frameworks, cards, source, fork, missing };
}
async function form(page: Page, date: string, result: "Pass" | "Fail") {
  await modal(page).getByLabel("Date", { exact: true }).fill(date); await modal(page).getByLabel("Result", { exact: true }).selectOption({ label: result });
}

test("Progress requires authentication and the shared menu opens the retained sample catalogue", async ({ page }) => {
  await page.goto("/progress"); await expect(page.getByRole("heading", { name: "Progress", exact: true })).toHaveCount(0);
  await page.request.post("/api/auth/login", { data: { identifier: "phase2", password: "local-test-only" } });
  await page.goto("/decks"); await page.getByRole("button", { name: "Overview menu" }).click(); await page.getByRole("menuitem", { name: "Progress", exact: true }).click();
  await expect(page.getByLabel("Framework", { exact: true })).toHaveValue("leaving-cert-hl");
  await expect(page.locator("tr[data-area-id]")).toHaveCount(3);
  await expect(page.locator("tr[data-item-id]")).toHaveCount(6);
  await expect(page.getByRole("button", { name: "Expand Trigonometry", exact: true })).toBeDisabled();
});

test("configured order, independent session expansion, blank/zero/all-skipped/incomplete scores and lazy histories", async ({ page }) => {
  const f = await fixture(page);
  try {
    const before = await f.repo.getPersonalUser(f.actor); let histories = 0;
    page.on("request", (request) => { if (request.url().includes("/history")) histories++; });
    await page.goto("/progress"); await expect(row(page, "control")).toBeVisible();
    expect(await page.locator("select option").allTextContents()).toEqual(["Practice Framework", "Alternative Framework", "Empty Framework"]);
    expect(await page.locator("tr[data-area-id]").evaluateAll((rows) => rows.map((row) => row.getAttribute("data-area-id")))).toEqual(["skills", "other-area", "empty-area"]);
    expect(await page.locator("tr[data-item-id]").evaluateAll((rows) => rows.map((row) => row.getAttribute("data-item-id")))).toEqual(["control", "zero", "skipped", "direct", "partial", "other-item"]);
    await expect(row(page, "control").locator("td").nth(0)).toHaveText("33%"); await expect(row(page, "control").locator("td").nth(1)).toHaveText("8");
    await expect(row(page, "zero").locator("td").nth(0)).toHaveText("0%"); await expect(row(page, "zero").locator("td").nth(1)).toHaveText("");
    await expect(row(page, "skipped").locator("td").nth(0)).toHaveText("100%");
    await expect(row(page, "direct").locator("td").nth(0)).toHaveText("");
    await expect(row(page, "other-item").locator("td").nth(0)).toHaveText("");
    await expect(row(page, "other-item").locator("td").nth(1)).toHaveText("");
    await expect(row(page, "partial").getByLabel("Completion unavailable")).toBeAttached();
    await expect(row(page, "partial").locator("td").first()).toHaveText("");
    await expect(row(page, "partial").locator(".assessment-pass")).toHaveCount(1);
    await expect(row(page, "partial").locator(".progress-tests-warning")).toHaveText("!");
    await expect(row(page, "partial").locator(".assessment-empty-control")).toHaveCount(0);
    expect(histories).toBe(0); expect(await f.repo.getPersonalUser(f.actor)).toEqual(before);
    await expect(page.locator('tr[data-area-id="skills"] .progress-content-title')).toBeEnabled();
    await page.getByRole("button", { name: "Collapse Algebra", exact: true }).press("Enter"); await expect(row(page, "control")).toBeHidden();
    await expect(row(page, "other-item")).toBeVisible(); await expect(page.locator('tr[data-area-id="skills"]').getByLabel("Completion unavailable")).toBeAttached();
    await page.getByLabel("Framework", { exact: true }).selectOption("alternative"); await expect(row(page, "alternative-item")).toBeVisible();
    await page.getByLabel("Framework", { exact: true }).selectOption("practice"); await expect(page.getByRole("button", { name: "Expand Algebra", exact: true })).toBeVisible();
    await page.reload(); await expect(page.getByRole("button", { name: "Expand Algebra", exact: true })).toBeVisible();
    await page.getByLabel("Framework", { exact: true }).selectOption("empty-framework"); await expect(page.getByText("No Areas are configured for this Framework yet.")).toBeVisible();
    await itemFixtureRoutes(page, f.repo, f.actor, []); await page.reload(); await expect(page.getByText("No Frameworks are available yet.")).toBeVisible();
  } finally { await f.client.close(); }
});

test("the entire Tests cell provides direct CRUD, mounted indicator refresh, source edits and retained conflict input", async ({ page }) => {
  const f = await fixture(page);
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/progress"); const direct = row(page, "direct"); await expect(direct).toBeVisible();
    const before = (await f.repo.getPersonalUser(f.actor))!;
    await direct.locator("td").last().click({ position: { x: 5, y: 5 } });
    await modal(page).getByRole("button", { name: "Add test", exact: true }).click(); await form(page, "2026-10-16", "Pass");
    await modal(page).getByRole("button", { name: "Save test", exact: true }).click(); await expect(modal(page).getByText("Item test", { exact: true })).toBeVisible();
    await modal(page).getByRole("button", { name: "Edit test 2026-10-16 from Item test", exact: true }).click(); await form(page, "2026-10-17", "Fail");
    // Another Item's write advances the deliberately shared list revision.
    await f.repo.users().updateOne({ _id: new ObjectId(f.actor) }, { $inc: { itemTestsRevision: 1 } });
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(page.getByText("Refreshing progress…", { exact: true })).toHaveCount(0);
    await expect(modal(page).getByLabel("Date", { exact: true })).toHaveValue("2026-10-17");
    await modal(page).getByRole("button", { name: "Save test", exact: true }).click();
    await expect(modal(page).getByLabel("Date", { exact: true })).toHaveValue("2026-10-17");
    await expect(modal(page).getByLabel("Result", { exact: true })).toHaveValue("fail");
    await expect(modal(page).getByRole("button", { name: "Resubmit reviewed change" })).toBeVisible();
    await modal(page).getByRole("button", { name: "Resubmit reviewed change" }).click();
    await modal(page).getByRole("button", { name: "Close", exact: true }).click(); await expect(direct.locator(".assessment-fail")).toHaveCount(1);
    await direct.getByRole("button").last().click();
    await modal(page).getByRole("button", { name: "Delete test 2026-10-17 from Item test", exact: true }).click(); await modal(page).getByRole("button", { name: "Confirm delete" }).click();
    await modal(page).getByRole("button", { name: "Close", exact: true }).click(); await expect(direct.getByRole("button", { name: /add first test/ })).toHaveText("+ Test");
    const control = row(page, "control"); await control.locator("td").last().click({ position: { x: 3, y: 3 } });
    await expect(modal(page).getByText("Source Card", { exact: true })).toBeVisible();
    await page.screenshot({ path: "/tmp/switchplay-progress-combined-history-390.png", fullPage: true });
    await modal(page).getByRole("button", { name: "Edit test 2026-10-10 from Original algebra practice", exact: true }).click(); await form(page, "2026-10-18", "Fail");
    await modal(page).getByRole("button", { name: "Save test", exact: true }).click(); await modal(page).getByRole("button", { name: "Close", exact: true }).click();
    await expect(control.locator(".assessment-fail")).toHaveCount(2);
    await page.reload(); await expect(row(page, "control").locator(".assessment-fail")).toHaveCount(2);
    const after = (await f.repo.getPersonalUser(f.actor))!;
    expect(after.decksData).toEqual(before.decksData);
    expect(after.cardsData.find((card) => card.cardTemplateId === f.source.root.cardTemplateId)!.tests).toMatchObject([{ date: "2026-10-18", result: false }]);
    expect(after.cardsData.find((card) => card.cardTemplateId === f.fork.root.cardTemplateId)!.tests).toHaveLength(1);
    await row(page, "partial").getByRole("button", { name: /assessment history unavailable/ }).click();
    await expect(modal(page).getByText(/Some assessment history may be missing/)).toBeVisible(); await expect(modal(page).locator("tbody tr")).toHaveCount(1);
  } finally { await f.client.close(); }
});

test("Tests cells and Item modal preserve normal presentation in all four complete/incomplete empty/known cases", async ({ page }) => {
  const f = await fixture(page);
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/progress");
    await expect(row(page, "direct").locator(".assessment-empty-control")).toHaveText("+ Test");
    await expect(row(page, "direct").locator(".progress-tests-warning")).toHaveCount(0);
    await row(page, "direct").locator(".progress-tests-trigger").click();
    await expect(modal(page).getByText("No tests recorded yet.", { exact: true })).toBeVisible();
    await expect(modal(page).getByText(/Some assessment history may be missing/)).toHaveCount(0);
    await expect(modal(page).getByRole("button", { name: "Add test", exact: true })).toBeEnabled();
    await modal(page).getByRole("button", { name: "Close", exact: true }).click();

    await expect(row(page, "control").locator(".assessment-pass, .assessment-fail")).toHaveText(["✓", "●"]);
    await expect(row(page, "control").locator(".progress-tests-warning")).toHaveCount(0);
    await row(page, "control").locator(".progress-tests-trigger").click();
    await expect(modal(page).locator("tbody tr")).toHaveCount(2);
    await expect(modal(page).getByText(/Some assessment history may be missing/)).toHaveCount(0);
    await modal(page).getByRole("button", { name: "Close", exact: true }).click();

    const populated = await page.evaluate(async (actor) => (await (await fetch("/api/items-data/partial/history", {
      headers: { "X-Personal-Viewer": actor }, cache: "no-store" })).json()).history, f.actor);
    expect(populated.state).toBe("incomplete"); expect(populated.results).toHaveLength(1);
    expect(populated.issues).toContainEqual({ code: "MISSING_PERSONAL_HISTORY_SOURCE", cardTemplateId: f.missing.data.historySourceCardTemplateId });
    expect(populated.latestThree).toEqual([]);
    const partial = row(page, "partial");
    await expect(partial.locator(".assessment-pass")).toHaveCount(1);
    await expect(partial.locator(".progress-tests-warning")).toHaveText("!");
    expect(await partial.locator(".progress-tests-warning").evaluate((element) => {
      const icon = element.getBoundingClientRect(), cell = element.closest("td")!.getBoundingClientRect();
      return icon.right <= cell.right && cell.right - icon.right < 7 && cell.bottom - icon.bottom < 7 && getComputedStyle(element).pointerEvents === "none";
    })).toBe(true);
    await row(page, "partial").locator(".progress-tests-trigger").click();
    await expect(modal(page).getByText(/Some assessment history may be missing/)).toBeVisible();
    await expect(modal(page).locator("tbody tr")).toHaveCount(1);
    await expect(modal(page).getByRole("button", { name: "Add test", exact: true })).toBeEnabled();
    await expect(modal(page).getByRole("button", { name: /^Edit test/ }).first()).toBeEnabled();
    await expect(modal(page).getByRole("button", { name: /^Delete test/ }).first()).toBeEnabled();
    await page.screenshot({ path: "/tmp/switchplay-progress-incomplete-known.png", fullPage: true });
    await modal(page).getByRole("button", { name: "Close", exact: true }).click();

    await f.repo.users().updateOne({ _id: new ObjectId(f.actor) }, { $set: { "cardsData.$[card].tests": [] } },
      { arrayFilters: [{ "card.cardTemplateId": f.missing.root.cardTemplateId }] });
    const unpopulated = await page.evaluate(async (actor) => (await (await fetch("/api/items-data/partial/history", {
      headers: { "X-Personal-Viewer": actor }, cache: "no-store" })).json()).history, f.actor);
    expect(unpopulated.state).toBe("incomplete"); expect(unpopulated.results).toEqual([]);
    expect(unpopulated.latestThree).toEqual([]);
    await page.reload();
    await expect(partial.locator(".assessment-empty-control")).toHaveText("+ Test");
    await expect(partial.locator(".progress-tests-warning")).toHaveText("!");
    await row(page, "partial").locator(".progress-tests-trigger").click();
    await expect(modal(page).getByText(/Some assessment history may be missing/)).toBeVisible();
    await expect(modal(page).getByText(/Readable results are shown below/)).toHaveCount(0);
    await expect(modal(page).getByText("No tests recorded yet.", { exact: true })).toHaveCount(0);
    await expect(modal(page).locator("tbody tr")).toHaveCount(0);
    await expect(modal(page).getByRole("button", { name: "Add test", exact: true })).toBeEnabled();
    await page.screenshot({ path: "/tmp/switchplay-progress-incomplete-empty.png", fullPage: true });
    await modal(page).getByRole("button", { name: "Add test", exact: true }).click();
    await expect(modal(page).getByRole("form", { name: "Add assessment" })).toBeVisible();
    await modal(page).getByRole("button", { name: "Cancel", exact: true }).click();
  } finally {
    await page.unrouteAll({ behavior: "wait" });
    await f.client.close();
  }
});

test("direct Item tests work on the real sample with no CardData or Deck membership", async ({ page }) => {
  assertDisposableDatabase(); const client = await new MongoClient(process.env.MONGODB_URI!).connect();
  try {
    const repo = new CardRepository(client.db(process.env.MONGODB_DB!), client), actor = new ObjectId(), username = `direct-${randomUUID()}`;
    const user = { _id: actor, username, email: `${username}@example.invalid`, passwordHash: hashSync("local-test-only", 4), cardsData: [], decksData: [], createdAt: new Date(), updatedAt: new Date() };
    await repo.users().insertOne(user); await page.request.post("/api/auth/login", { data: { identifier: username, password: "local-test-only" } });
    await page.goto("/progress"); const item = row(page, "factor-theorem"); await expect(item).toBeVisible();
    await item.getByRole("button", { name: /add first test/ }).click(); await modal(page).getByRole("button", { name: "Add test", exact: true }).click(); await form(page, "2026-10-20", "Pass");
    await modal(page).getByRole("button", { name: "Save test", exact: true }).click(); await modal(page).getByRole("button", { name: "Close", exact: true }).click();
    await expect(item.locator(".assessment-pass")).toHaveCount(1); await expect(item.locator("td").nth(0)).toHaveText(""); await expect(item.locator("td").nth(1)).toHaveText("");
    const personal = (await repo.getPersonalUser(actor.toHexString()))!; expect(personal.cardsData).toEqual([]); expect(personal.decksData).toEqual([]);
    expect(personal.itemTests).toMatchObject([{ itemId: "factor-theorem", result: true }]);
  } finally { await client.close(); }
});

test("an obsolete summary cannot replace a new Framework and refresh failures never fabricate empty progress", async ({ page }) => {
  const f = await fixture(page);
  try {
    let release!: () => void, started = false;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    await page.route("**/api/frameworks/practice/summary", async (route) => {
      started = true; const framework = await readFrameworkSummary(f.repo, f.actor, "practice", f.frameworks); await gate;
      await route.fulfill({ json: framework, headers: { "X-Personal-Viewer": f.actor } }).catch(() => {});
    });
    await page.goto("/progress"); await expect.poll(() => started).toBe(true);
    await page.getByLabel("Framework", { exact: true }).selectOption("alternative"); await expect(row(page, "alternative-item")).toBeVisible(); release();
    await expect(page.getByRole("region", { name: "Alternative Framework", exact: true })).toBeVisible(); await expect(row(page, "control")).toHaveCount(0);
    await page.route("**/api/frameworks/alternative/summary", (route) => route.fulfill({ status: 500, headers: { "X-Personal-Viewer": f.actor }, json: { error: "database unavailable" } }));
    await page.evaluate(() => window.dispatchEvent(new Event("focus"))); await expect(page.locator("main").getByRole("alert")).toContainText("Progress could not be loaded");
    await expect(row(page, "alternative-item").getByLabel("Completion unavailable")).toBeAttached();
    await expect(row(page, "alternative-item").locator("td").first()).toHaveText("");
    await expect(row(page, "alternative-item").locator(".assessment-pass, .assessment-fail")).toHaveCount(2);
    await expect(row(page, "alternative-item").locator(".progress-tests-warning")).toHaveText("!");
    await page.unroute("**/api/frameworks/alternative/summary"); await page.getByRole("button", { name: "Refresh progress" }).click();
    await expect(row(page, "alternative-item").locator("td").nth(0)).toHaveText("33%");
  } finally { await f.client.close(); }
});

test("another actor's response is rejected and changing accounts does not reuse expansion or assessments", async ({ page }) => {
  await page.request.post("/api/auth/login", { data: { identifier: "phase2", password: "local-test-only" } }); await page.goto("/progress");
  await page.getByRole("button", { name: "Collapse Algebra", exact: true }).click();
  await page.request.post("/api/auth/login", { data: { identifier: "other", password: "local-test-only" } }); await page.reload();
  await expect(page.getByRole("button", { name: "Collapse Algebra", exact: true })).toBeVisible();
  await page.route("**/api/frameworks", (route) => route.fulfill({ json: { viewerUserId: process.env.PHASE2_USER_ID!, frameworks: [] }, headers: { "X-Personal-Viewer": process.env.PHASE2_USER_ID! } }));
  await page.reload(); await expect(page.locator("main").getByRole("alert")).toContainText("Your sign-in session changed"); await expect(page.locator(".progress-table")).toHaveCount(0);
});

for (const width of [320, 390, 1440]) test(`Progress visual layout, Tests touch target and modal keyboard focus at ${width}`, async ({ page }) => {
  const f = await fixture(page);
  try {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 }); await page.goto("/progress"); await expect(row(page, "control")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const trigger = row(page, "direct").getByRole("button", { name: /add first test/ }); const box = (await trigger.boundingBox())!; expect(box.height).toBeGreaterThanOrEqual(44);
    const chevron = (await page.getByRole("button", { name: "Collapse Algebra", exact: true }).boundingBox())!;
    expect(chevron.width).toBeGreaterThanOrEqual(44); expect(chevron.height).toBeGreaterThanOrEqual(44);
    const areaTitle = (await page.locator('tr[data-area-id="skills"] .progress-content-title').boundingBox())!;
    const itemTitle = (await row(page, "control").locator(".progress-content-title").boundingBox())!;
    expect(itemTitle.x).toBeGreaterThan(areaTitle.x);
    const longCell = (await row(page, "control").locator("td").last().boundingBox())!;
    const longTrigger = (await row(page, "control").getByRole("button", { name: /open assessment history/ }).boundingBox())!;
    const borderHeight = await row(page, "control").locator("td").last().evaluate((cell) => {
      const style = getComputedStyle(cell); return parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
    });
    expect(longTrigger.height).toBeCloseTo(Math.max(48, longCell.height - borderHeight), 1);
    await page.screenshot({ path: `/tmp/switchplay-progress-${width}.png`, fullPage: true });
    await trigger.focus(); await page.keyboard.press("Enter"); await expect(modal(page)).toBeVisible();
    await expect(modal(page).getByRole("button", { name: "Add test", exact: true })).toBeEnabled();
    await modal(page).getByRole("button", { name: "Close", exact: true }).focus(); await page.keyboard.press("Tab"); await expect(modal(page).getByRole("button", { name: "Add test", exact: true })).toBeFocused();
    await page.screenshot({ path: `/tmp/switchplay-progress-modal-${width}.png`, fullPage: true });
    await page.keyboard.press("Escape"); await expect(modal(page)).toHaveCount(0); await expect(trigger).toBeFocused();
    await row(page, "control").getByRole("button", { name: /open assessment history/ }).click();
    const resultHeading = modal(page).getByRole("columnheader", { name: "Result", exact: true });
    const resultColumn = await resultHeading.evaluate((heading) => {
      const box = heading.getBoundingClientRect(), style = getComputedStyle(heading);
      return { width: box.width, whiteSpace: style.whiteSpace, fits: heading.scrollWidth <= heading.clientWidth };
    });
    expect(resultColumn.width).toBeGreaterThanOrEqual(width <= 400 ? 52 : 58);
    expect(resultColumn.whiteSpace).toBe("nowrap"); expect(resultColumn.fits).toBe(true);
    await page.screenshot({ path: `/tmp/switchplay-progress-result-column-${width}.png`, fullPage: true });
    await modal(page).getByRole("button", { name: "Close", exact: true }).click();
    const noWrites = (await f.repo.getPersonalUser(f.actor))!; expect(noWrites.itemTests).toEqual([]);
  } finally { await f.client.close(); }
});

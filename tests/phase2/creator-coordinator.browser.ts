import { expect, test, type Page } from "@playwright/test";
import { MongoClient } from "mongodb";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";
let client: MongoClient;
test.beforeAll(async () => { assertDisposableDatabase(); client = await new MongoClient(process.env.MONGODB_URI!).connect(); });
test.afterAll(async () => { await client?.close(); });
const db = () => client.db(process.env.MONGODB_DB!);
const cardRoot = (id: string) => db().collection("cardTemplates").findOne({ cardTemplateId: id });
const card = (page: Page, id: string) => page.locator(`.creator-column[data-card-template-id="${id}"]`);
function gate() { let resolve!: () => void; const promise = new Promise<void>((done) => { resolve = done; }); return { promise, resolve }; }
async function open(page: Page) {
  await page.request.post("/api/auth/login", { data: { identifier: "phase2", password: "local-test-only" } });
  await page.goto("/creator/new"); await expect(page.getByRole("button", { name: "Add card", exact: true })).toBeVisible();
}
async function add(page: Page) {
  const before = await page.locator(".creator-column[data-card-template-id]").count();
  await page.getByRole("button", { name: "Add card", exact: true }).click();
  await expect(page.locator(".creator-column[data-card-template-id]")).toHaveCount(before + 1);
  const id = (await page.locator(".creator-column[data-card-template-id]").last().getAttribute("data-card-template-id"))!;
  await expect.poll(async () => !!await cardRoot(id)).toBe(true); return id;
}
async function editTitle(page: Page, id: string, title: string) {
  await card(page, id).locator(".creator-card-title-button").click();
  await page.locator(".creator-modal textarea").fill(title);
  await page.locator(".creator-modal").getByRole("button", { name: "Save", exact: true }).click();
}
async function editStep(page: Page, id: string, text: string) {
  await card(page, id).locator(".creator-pair-step").first().click(); await page.locator(".creator-modal textarea").fill(text);
  await page.locator(".creator-modal").getByRole("button", { name: "Save", exact: true }).click();
}
async function editDeck(page: Page, title: string) {
  await page.getByRole("button", { name: "Edit deck title and introduction" }).click(); await page.locator(".creator-modal textarea").fill(title);
  await page.locator(".creator-modal").getByRole("button", { name: "Save", exact: true }).click();
}
async function publishCard(page: Page, id: string) {
  const button = card(page, id).getByRole("button", { name: /^Publish Card/ });
  await expect(button).toBeEnabled(); await button.click(); await expect.poll(async () => (await cardRoot(id))?.latestVersion).toBe(1); await expect(button).toHaveText("Published");
}
async function remove(page: Page, id: string) {
  await card(page, id).locator(".creator-card-title-button").click();
  await page.locator(".creator-modal").getByRole("button", { name: "Delete Card", exact: true }).click();
  await page.locator(".creator-modal").getByRole("button", { name: "Delete", exact: true }).click();
  await expect(card(page, id)).toHaveCount(0);
}

test("untouched Create makes no writes; rapid Add and immediate Card edit retain IDs and remove top Save Draft", async ({ page }) => {
  await open(page); const count = await db().collection("deckTemplates").countDocuments();
  await expect(page.locator(".creator-column[data-card-template-id]")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Save Draft", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Publish and leave", exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "Decks", exact: true }).click(); await expect(page).toHaveURL(/\/decks$/);
  await expect(page.getByRole("dialog", { name: "Leave Creator confirmation" })).toHaveCount(0);
  expect(await db().collection("deckTemplates").countDocuments()).toBe(count);
  await page.goto("/creator/new");
  const pause = gate();
  await page.route("**/api/deck-templates", async (route) => { const response = await route.fetch(); await pause.promise; await route.fulfill({ response }); });
  await page.getByRole("button", { name: "Add card", exact: true }).click();
  const first = (await page.locator(".creator-column[data-card-template-id]").first().getAttribute("data-card-template-id"))!;
  await expect(card(page, first).getByRole("button", { name: "Publish Card 1", exact: true })).toHaveCount(0);
  await editTitle(page, first, "Immediate edit");
  await page.getByRole("button", { name: "Add card", exact: true }).click();
  const second = (await page.locator(".creator-column[data-card-template-id]").last().getAttribute("data-card-template-id"))!;
  pause.resolve();
  await expect.poll(async () => (await cardRoot(first))?.draft?.intro.title).toBe("Immediate edit");
  await expect.poll(async () => !!await cardRoot(second)).toBe(true);
  await expect(card(page, first).getByRole("button", { name: "Publish Card 1", exact: true })).toBeEnabled();
  await expect(card(page, second).getByRole("button", { name: "Publish Card 2", exact: true })).toHaveCount(0);
  const id = page.url().split("/").at(-1)!;
  await expect.poll(async () => (await db().collection("deckTemplates").findOne({ deckTemplateId: id }))?.draft?.cards.map((ref: { cardTemplateId: string }) => ref.cardTemplateId)).toEqual([first, second]);
});

test("Card publication is independent of failed Card saves; Deck warning Cancel/confirm never flushes Card edits", async ({ page }) => {
  await open(page); const a = await add(page), b = await add(page);
  await editTitle(page, a, "A"); await publishCard(page, a); await editTitle(page, b, "B");
  let failedSaves = 0;
  await page.route(`**/api/card-templates/${a}`, async (route) => {
    if (route.request().method() === "PATCH" && route.request().postDataJSON().type === "save") { failedSaves++; await route.fulfill({ status: 400, json: { code: "INVALID_CONTENT", error: "INVALID_CONTENT" } }); }
    else await route.continue();
  });
  await editStep(page, a, "Known failed local edit");
  await expect(page.getByRole("button", { name: "Retry Save Card 1", exact: true })).toBeVisible();
  await publishCard(page, b); await editDeck(page, "Scoped Deck");
  const deck = page.getByRole("button", { name: "Publish Deck", exact: true }); await expect(deck).toBeEnabled();
  await deck.click(); const warning = page.getByRole("dialog", { name: "Unpublished Card changes" }); await expect(warning).toBeVisible();
  await warning.getByRole("button", { name: "Cancel", exact: true }).click();
  const id = page.url().split("/").at(-1)!; expect(await db().collection("deckTemplateVersions").countDocuments({ deckTemplateId: id })).toBe(0);
  await deck.click(); await warning.getByRole("button", { name: "Publish anyway", exact: true }).click(); await expect.poll(async () => !!await db().collection("deckTemplateVersions").findOne({ deckTemplateId: id })).toBe(true); await expect(deck).toHaveText("Published");
  const published = await db().collection("deckTemplateVersions").findOne({ deckTemplateId: id });
  expect(published!.content.cards).toEqual([{ cardTemplateId: a, cardVersionAtPublish: 1 }, { cardTemplateId: b, cardVersionAtPublish: 1 }]);
  expect(failedSaves).toBe(1); expect((await cardRoot(a))!.draft).toBeNull();
});

test("saved newer Card draft warns and Deck publishes its older published Card version", async ({ page }) => {
  await open(page); const a = await add(page); await editTitle(page, a, "A"); await publishCard(page, a);
  await editStep(page, a, "Newer saved draft"); await expect(card(page, a).getByRole("button", { name: "Publish Card 1" })).toBeEnabled();
  await editDeck(page, "Older published Card is permitted"); const deck = page.getByRole("button", { name: "Publish Deck", exact: true }); await expect(deck).toBeEnabled();
  await deck.click(); await page.getByRole("dialog", { name: "Unpublished Card changes" }).getByRole("button", { name: "Publish anyway" }).click();
  await expect(deck).toHaveText("Published"); await expect.poll(async () => !!await db().collection("deckTemplateVersions").findOne({ deckTemplateId: page.url().split("/").at(-1)! })).toBe(true); expect((await cardRoot(a))!.latestVersion).toBe(1); expect((await cardRoot(a))!.draft.steps[0].description).toBe("Newer saved draft");
});

test("removed Card save continues after column unmount and final removal is allowed", async ({ page }) => {
  await open(page); const a = await add(page), pause = gate();
  let started = false;
  await page.route(`**/api/card-templates/${a}`, async (route) => { if (route.request().method() === "PATCH") { started = true; await pause.promise; await route.continue(); } else await route.continue(); });
  await editStep(page, a, "Independent detached content"); await expect.poll(() => started).toBe(true);
  await remove(page, a); pause.resolve();
  await expect.poll(async () => (await cardRoot(a))?.draft.steps[0].description).toBe("Independent detached content");
  const id = page.url().split("/").at(-1)!;
  await expect.poll(async () => (await db().collection("deckTemplates").findOne({ deckTemplateId: id }))?.draft.cards).toEqual([]);
  await expect(page.locator(".creator-entity-save-error")).toHaveCount(0);
});

test("authorized intro upload keeps its original Card after renumbering and after detachment", async ({ page }) => {
  await open(page); const a = await add(page), b = await add(page), pause = gate();
  let started = false;
  const origin = process.env.PHASE2_MEDIA_FIXTURE_ORIGIN!;
  await page.route(`${origin}/upload`, async (route) => { started = true; await pause.promise; await route.continue(); });
  await card(page, b).locator('.creator-card-intro-media-slot input[type="file"]').setInputFiles({ name: "stable-target.mp4", mimeType: "video/mp4", buffer: Buffer.from("fixture video") });
  await expect.poll(() => started).toBe(true);
  await remove(page, a); await expect(card(page, b).locator(".creator-card-label-button")).toHaveText("Card 1");
  await remove(page, b);
  await page.getByRole("link", { name: "Decks", exact: true }).click();
  await expect(page).toHaveURL(/\/decks$/); pause.resolve();
  await expect.poll(async () => (await cardRoot(b))?.draft.intro.mediaItem?.description).toBe("stable-target.mp4");
  expect((await cardRoot(a))!.draft.intro.mediaItem).toBeNull();
  await expect(page.locator(".creator-entity-save-error")).toHaveCount(0);
});

test("exhausted autosave failure exposes only its Card Retry Save, and retry saves latest content", async ({ page }) => {
  await open(page); const a = await add(page), b = await add(page); let fail = true, attempts = 0;
  await page.route(`**/api/card-templates/${a}`, async (route) => {
    if (route.request().method() === "PATCH" && fail) { attempts++; await route.fulfill({ status: 503, json: { error: "Temporary failure" } }); } else await route.continue();
  });
  await editTitle(page, a, "First failed edit");
  await expect(page.getByRole("button", { name: "Retry Save Card 1", exact: true })).toBeVisible({ timeout: 25000 }); expect(attempts).toBe(4);
  await expect(page.getByRole("button", { name: "Retry Save Card 2", exact: true })).toHaveCount(0);
  await editTitle(page, a, "Latest retry content"); await editTitle(page, b, "Independent B"); await publishCard(page, b);
  fail = false; await page.getByRole("button", { name: "Retry Save Card 1", exact: true }).click();
  await expect.poll(async () => (await cardRoot(a))?.draft.intro.title).toBe("Latest retry content"); await expect(page.locator(".creator-entity-save-error")).toHaveCount(0);
});

for (const width of [375, 390]) {
  test(`scoped Creator mobile ${width} preserves scroll, modal margins and upload header position`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height: 812 }, isMobile: true, hasTouch: true, baseURL: process.env.PHASE2_BASE_URL });
    const page = await context.newPage();
    try {
      await open(page); const a = await add(page); await add(page);
      const geometry = await page.evaluate(() => {
        const shell = document.querySelector(".creator-scroll-shell")!, header = document.querySelector(".creator-column[data-card-template-id] .creator-card-header")!;
        const upload = header.querySelector(".creator-card-intro-media-slot")!, h = header.getBoundingClientRect(), u = upload.getBoundingClientRect();
        return { width: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth, shell: shell.getBoundingClientRect().width, canvas: shell.scrollWidth,
          height: h.height, rows: getComputedStyle(header).gridTemplateRows, inset: h.bottom - u.top, bottom: h.bottom - u.bottom, font: getComputedStyle(header.querySelector(".creator-card-label-button")!).fontSize };
      });
      expect(geometry.width).toBe(width); expect(geometry.viewport).toBe(width); expect(geometry.shell).toBe(width); expect(geometry.canvas).toBeGreaterThan(width);
      expect(geometry.height).toBe(100); expect(geometry.rows).toBe("18px 42px 20px"); expect(geometry.inset).toBeGreaterThanOrEqual(28); expect(geometry.inset).toBeLessThanOrEqual(29); expect(geometry.bottom).toBeGreaterThanOrEqual(8); expect(geometry.font).toBe("12px");
      await card(page, a).locator(".creator-pair-step").first().click(); const modal = await page.locator(".creator-modal").boundingBox();
      expect(modal!.x).toBeCloseTo(16); expect(width - modal!.x - modal!.width).toBeCloseTo(16);
      await page.locator(".creator-modal").getByRole("button", { name: "Close", exact: true }).click();
      await page.getByRole("button", { name: "Add note for Deck", exact: true }).click();
      const note = page.getByRole("dialog", { name: "Update note for Deck" });
      const noteBox = await note.boundingBox(); expect(noteBox!.x).toBeCloseTo(16); expect(width - noteBox!.x - noteBox!.width).toBeCloseTo(16);
      await note.getByRole("button", { name: "Cancel", exact: true }).click();
      let failing = true;
      await page.route(`**/api/card-templates/${a}`, async (route) => {
        if (route.request().method() === "PATCH" && failing) await route.fulfill({ status: 400, json: { code: "INVALID_CONTENT" } }); else await route.continue();
      });
      await editTitle(page, a, "Mobile retry check");
      const retry = page.getByRole("button", { name: "Retry Save Card 1", exact: true }); await expect(retry).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
      failing = false; await retry.click(); await expect(page.locator(".creator-entity-save-error")).toHaveCount(0);
      await expect.poll(async () => (await cardRoot(a))?.draft.intro.title).toBe("Mobile retry check");
      await expect(page.getByRole("button", { name: "Publish and leave", exact: true })).toHaveCount(0);
      await page.getByRole("link", { name: "Decks", exact: true }).click();
      const leave = page.getByRole("dialog", { name: "Leave Creator confirmation" }); await expect(leave).toBeVisible();
      const leaveBox = await leave.boundingBox(); expect(leaveBox!.x).toBeCloseTo(16); expect(width - leaveBox!.x - leaveBox!.width).toBeCloseTo(16);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
      const publishAndLeaveBox = await leave.getByRole("button", { name: "Publish and leave", exact: true }).boundingBox();
      expect(publishAndLeaveBox!.x).toBeGreaterThanOrEqual(leaveBox!.x); expect(publishAndLeaveBox!.x + publishAndLeaveBox!.width).toBeLessThanOrEqual(leaveBox!.x + leaveBox!.width);
      await leave.getByRole("button", { name: "Cancel", exact: true }).click();
    } finally { await context.close(); }
  });
}

test("Publish and leave retains successful versions and retries only remaining publications", async ({ page }) => {
  await open(page); const a = await add(page), b = await add(page);
  await editTitle(page, a, "A"); await editTitle(page, b, "B"); await editDeck(page, "Recoverable leave");
  await expect(card(page, b).getByRole("button", { name: "Publish Card 2" })).toBeEnabled();
  let failCard = true, failDeck = true;
  await page.route(`**/api/card-templates/${b}`, async (route) => {
    if (route.request().method() === "PATCH" && route.request().postDataJSON().type === "publish" && failCard) await route.fulfill({ status: 400, json: { code: "SIMULATED_CARD_FAILURE" } }); else await route.continue();
  });
  await page.route("**/api/deck-templates/*/publish", async (route) => {
    if (route.request().method() === "POST" && failDeck) await route.fulfill({ status: 400, json: { code: "SIMULATED_DECK_FAILURE" } }); else await route.continue();
  });
  const leave = page.getByRole("button", { name: "Publish and leave", exact: true });
  await expect(leave).toHaveCount(0);
  await page.getByRole("link", { name: "Decks", exact: true }).click();
  await leave.click();
  await expect(page.getByText(/SIMULATED_CARD_FAILURE/)).toBeVisible(); expect((await cardRoot(a))!.latestVersion).toBe(1); expect((await cardRoot(b))!.latestVersion).toBe(0);
  await expect(leave).toHaveCount(0);
  failCard = false; await page.getByRole("link", { name: "Decks", exact: true }).click(); await leave.click();
  await expect(page.getByText(/SIMULATED_DECK_FAILURE/)).toBeVisible(); expect((await cardRoot(b))!.latestVersion).toBe(1);
  failDeck = false; await page.getByRole("link", { name: "Decks", exact: true }).click(); await leave.click(); await expect(page).toHaveURL(/\/decks$/);
  expect(await db().collection("cardTemplateVersions").countDocuments({ cardTemplateId: { $in: [a, b] } })).toBe(2);
});

test("pending local Card edits warn; remote changes invalidate consent and retain local edits", async ({ page }) => {
  await open(page); const a = await add(page); await editTitle(page, a, "A"); await publishCard(page, a); await editDeck(page, "Review consistency");
  await expect(page.getByRole("button", { name: "Publish Deck", exact: true })).toBeEnabled();
  const pause = gate(); let saving = false;
  await page.route(`**/api/card-templates/${a}`, async (route) => {
    if (route.request().method() === "PATCH" && route.request().postDataJSON().type === "save") { saving = true; await pause.promise; } await route.continue();
  });
  await editStep(page, a, "Pending browser-only change"); await expect.poll(() => saving).toBe(true);
  await page.getByRole("button", { name: "Publish Deck", exact: true }).click();
  const warning = page.getByRole("dialog", { name: "Unpublished Card changes" }); await expect(warning).toBeVisible();
  const remote = await (await page.request.get(`/api/card-templates/${a}`)).json();
  expect((await page.request.patch(`/api/card-templates/${a}`, { data: { type: "save", revision: remote.root.revision, content: { ...remote.content, intro: { ...remote.content.intro, title: "Another tab" } } } })).ok()).toBeTruthy();
  const rejection = page.waitForResponse((response) => response.url().endsWith("/publish") && response.request().method() === "POST");
  await warning.getByRole("button", { name: "Publish anyway", exact: true }).click();
  const rejected = await rejection;
  expect(rejected.status()).toBe(409); expect((await rejected.json()).code).toBe("DECK_PUBLICATION_REVIEW_CONFLICT");
  await expect(page.getByText("The Cards or Deck changed during publication review. Review and confirm again. Earlier successful publications are retained.", { exact: true })).toBeVisible();
  const id = page.url().split("/").at(-1)!; expect(await db().collection("deckTemplateVersions").countDocuments({ deckTemplateId: id })).toBe(0);
  pause.resolve(); await expect(page.locator(".creator-entity-save-error")).toContainText("Save conflict");
  await expect(card(page, a).locator(".creator-pair-step").first()).toHaveText("Pending browser-only change");
  expect((await cardRoot(a))!.draft.intro.title).toBe("Another tab");
});

import { expect, test, type Page } from "@playwright/test";
import { MongoClient, ObjectId } from "mongodb";
import { randomUUID } from "node:crypto";
import { CardRepository } from "../../src/lib/cards/repository";
import { createDefaultDeckContent } from "../../src/lib/cards/creatorDefaults";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";
import { addDaysToDateOnly } from "../../src/lib/dateOnly";

let client: MongoClient;
test.beforeAll(async () => { assertDisposableDatabase(); client = await new MongoClient(process.env.MONGODB_URI!).connect(); });
test.afterAll(async () => { await client?.close(); });
const db = () => client.db(process.env.MONGODB_DB!);
const actor = () => new ObjectId(process.env.PHASE2_USER_ID!);
const root = (id: string) => db().collection("deckTemplates").findOne({ deckTemplateId: id });
const cardRoot = (id: string) => db().collection("cardTemplates").findOne({ cardTemplateId: id });
const column = (page: Page, id: string) => page.locator(`.creator-column[data-card-template-id="${id}"]`);
const popup = (page: Page) => page.getByRole("dialog", { name: "My Drafts", exact: true });
function gate() { let resolve!: () => void; const promise = new Promise<void>((done) => { resolve = done; }); return { promise, resolve }; }
async function open(page: Page) {
  await page.request.post("/api/auth/login", { data: { identifier: "phase2", password: "local-test-only" } });
  await page.goto("/creator/new");
}
async function title(page: Page, value: string) {
  await page.getByRole("button", { name: "Edit deck title and introduction" }).click();
  await page.locator(".creator-modal textarea").fill(value); await page.locator(".creator-modal").getByRole("button", { name: "Save", exact: true }).click();
  await expect(page).toHaveURL(/\/creator\/edit\//);
  const id = new URL(page.url()).pathname.split("/").at(-1)!;
  await expect.poll(async () => (await root(id))?.draft?.title).toBe(value); return id;
}
async function target() {
  const id = randomUUID(), title = `Target ${id}`;
  await new CardRepository(db(), client).createPrivateGraph(actor().toHexString(), id, { ...createDefaultDeckContent([]), title }, []);
  return { id, title };
}
async function add(page: Page) {
  await page.getByRole("button", { name: "Add card", exact: true }).click();
  const id = (await page.locator(".creator-column[data-card-template-id]").last().getAttribute("data-card-template-id"))!;
  await expect.poll(async () => !!await cardRoot(id)).toBe(true); return id;
}
async function editStep(page: Page, id: string, value: string) {
  await column(page, id).locator(".creator-pair-step").first().click(); await page.locator(".creator-modal textarea").fill(value);
  await page.locator(".creator-modal").getByRole("button", { name: "Save", exact: true }).click();
}

test("My Drafts is authenticated/read-only; untouched sessions stay absent and persisted current selection simply closes", async ({ page }) => {
  expect((await page.request.get("/api/creator/drafts")).status()).toBe(401);
  await open(page); const count = await db().collection("deckTemplates").countDocuments();
  await page.getByRole("button", { name: "My Drafts", exact: true }).click(); await expect(popup(page)).toBeVisible();
  await expect(popup(page).getByText("Loading drafts…")).toHaveCount(0);
  expect(await db().collection("deckTemplates").countDocuments()).toBe(count);
  await popup(page).getByRole("button", { name: "Close", exact: true }).click();
  const id = await title(page, `Discoverable ${randomUUID()}`), before = await root(id);
  await page.getByRole("button", { name: "My Drafts", exact: true }).click();
  await expect(popup(page).getByRole("button", { name: before!.draft.title, exact: true })).toHaveAttribute("aria-current", "true");
  await popup(page).getByRole("button", { name: before!.draft.title, exact: true }).click();
  await expect(popup(page)).toHaveCount(0); await expect(page).toHaveURL(new RegExp(`/creator/edit/${id}$`));
  expect(await root(id)).toEqual(before);
  const response = await page.request.get("/api/creator/drafts"); expect(response.headers()["cache-control"]).toBe("no-store");
  const list = await response.json(); expect(list.find((item: { deckTemplateId: string }) => item.deckTemplateId === id).status).toBe("unpublished");
  for (const item of list) expect(Object.keys(item).sort()).toEqual(["deckTemplateId", "status", "title", "updatedAt"]);
  await page.goto("/decks"); await expect(page.getByRole("button", { name: `Open ${before!.draft.title}`, exact: true })).toHaveCount(0);
  const repo = new CardRepository(db(), client); await repo.archiveDeckData(actor().toHexString(), id); await page.reload();
  await expect(page.getByRole("button", { name: `Restore ${before!.draft.title}`, exact: true })).toHaveCount(0);
  const user = await db().collection("users").findOne({ _id: actor() });
  expect(user!.decksData.find((data: { deckTemplateId: string }) => data.deckTemplateId === id).deckTemplateVersion).toBeNull();
  await page.goto("/creator/new"); await page.getByRole("button", { name: "My Drafts", exact: true }).click();
  await popup(page).getByRole("button", { name: before!.draft.title, exact: true }).click(); await expect(page).toHaveURL(new RegExp(`/creator/edit/${id}$`));
});

test("switching waits for the latest save and gives each Deck a fresh board/coordinator", async ({ page }) => {
  const other = await target(); await open(page); const id = await title(page, `Save before switching ${randomUUID()}`), cardId = await add(page), pause = gate();
  let started = false;
  await page.route(`**/api/card-templates/${cardId}`, async (route) => {
    if (route.request().method() === "PATCH") { started = true; await pause.promise; } await route.continue();
  });
  await editStep(page, cardId, "Keep this local edit"); await expect.poll(() => started).toBe(true);
  await page.getByRole("button", { name: "My Drafts", exact: true }).click();
  await popup(page).getByRole("button", { name: other.title, exact: true }).click();
  await expect(popup(page).getByRole("status")).toBeVisible(); await expect(page).toHaveURL(new RegExp(`/creator/edit/${id}$`));
  pause.resolve(); await expect(page).toHaveURL(new RegExp(`/creator/edit/${other.id}$`));
  await expect(page.locator(".creator-column[data-card-template-id]")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Edit deck title and introduction" })).toContainText(other.title);
  await page.getByRole("button", { name: "My Drafts", exact: true }).click();
  const original = (await root(id))!.draft.title;
  await popup(page).getByRole("button", { name: original, exact: true }).click(); await expect(page).toHaveURL(new RegExp(`/creator/edit/${id}$`));
  await expect(column(page, cardId).locator(".creator-pair-step").first()).toContainText("Keep this local edit");
  expect((await cardRoot(cardId))!.latestVersion).toBe(0); expect((await root(id))!.latestVersion).toBe(0);
  await editStep(page, cardId, "A subsequent edit belongs to the original Card");
  await expect.poll(async () => (await cardRoot(cardId))?.draft?.steps[0].description).toBe("A subsequent edit belongs to the original Card");
  expect((await root(other.id))!.draft.cards).toEqual([]);
});

for (const status of [400, 409]) test(`failed/conflicted save ${status} prevents switching and preserves local content`, async ({ page }) => {
  const other = await target(); await open(page); const id = await title(page, `Blocked ${status} ${randomUUID()}`), cardId = await add(page);
  await page.route(`**/api/card-templates/${cardId}`, async (route) => {
    if (route.request().method() === "PATCH") await route.fulfill({ status, json: { code: status === 409 ? "STALE_REVISION" : "INVALID_CONTENT" } }); else await route.continue();
  });
  await editStep(page, cardId, "Retained local content"); await expect(page.locator(".creator-entity-save-error")).toBeVisible();
  await page.getByRole("button", { name: "My Drafts", exact: true }).click(); await popup(page).getByRole("button", { name: other.title, exact: true }).click();
  await expect(popup(page).getByRole("alert")).toContainText("Current work could not be saved");
  await expect(page).toHaveURL(new RegExp(`/creator/edit/${id}$`)); await popup(page).getByRole("button", { name: "Close", exact: true }).click();
  await expect(column(page, cardId).locator(".creator-pair-step").first()).toContainText("Retained local content");
  expect((await cardRoot(cardId))!.draft.steps[0].description).toBeNull();
});

for (const succeeds of [true, false]) test(`switching waits for an attached upload; upload ${succeeds ? "success saves before navigation" : "failure keeps Creator open"}`, async ({ page }) => {
  const other = await target(); await open(page); const id = await title(page, `Upload switch ${randomUUID()}`), cardId = await add(page), pause = gate();
  let started = false, failed = !succeeds;
  await page.route(`${process.env.PHASE2_MEDIA_FIXTURE_ORIGIN}/upload`, async (route) => {
    started = true; await pause.promise;
    if (failed) await route.fulfill({ status: 500, body: "Fixture upload failure" }); else await route.continue();
  });
  const input = column(page, cardId).locator('.creator-card-intro-media-slot input[type="file"]');
  const file = { name: "navigation.mp4", mimeType: "video/mp4", buffer: Buffer.from("local fixture video") };
  await input.setInputFiles(file); await expect.poll(() => started).toBe(true);
  await page.getByRole("button", { name: "My Drafts", exact: true }).click(); await popup(page).getByRole("button", { name: other.title, exact: true }).click();
  await expect(popup(page).getByRole("status")).toBeVisible(); await expect(page).toHaveURL(new RegExp(`/creator/edit/${id}$`)); pause.resolve();
  if (!succeeds) {
    await expect(popup(page).getByRole("alert")).toContainText("save or upload errors"); await expect(page).toHaveURL(new RegExp(`/creator/edit/${id}$`));
    await popup(page).getByRole("button", { name: "Close", exact: true }).click(); failed = false; await input.setInputFiles(file);
    await expect.poll(async () => (await cardRoot(cardId))?.draft?.intro.mediaItem?.description).toBe("navigation.mp4");
    await page.getByRole("button", { name: "My Drafts", exact: true }).click(); await popup(page).getByRole("button", { name: other.title, exact: true }).click();
  }
  await expect(page).toHaveURL(new RegExp(`/creator/edit/${other.id}$`));
  expect((await cardRoot(cardId))!.draft.intro.mediaItem.description).toBe("navigation.mp4");
});

test("zero-Card working Deck publishes, reloads, archives/restores and keeps its cadence anchor after later Add", async ({ page }) => {
  await open(page); const name = `Empty ${randomUUID()}`, id = await title(page, name);
  await page.getByRole("button", { name: "Publish Deck", exact: true }).click();
  await expect.poll(async () => (await root(id))?.latestVersion).toBe(1);
  await page.getByRole("link", { name: "Decks", exact: true }).click(); await page.getByRole("button", { name: `Open ${name}`, exact: true }).click();
  await expect(page.locator(".deck-detail h1")).toHaveText(name); await expect(page.locator(".detail-progress")).toHaveText("Completion 0%");
  await expect(page.locator(".detail-confidence, .deck-scene-frame, .deck-card, .focused-card-layer")).toHaveCount(0);
  const user = await db().collection("users").findOne({ _id: actor() });
  const personal = user!.decksData.find((data: { deckTemplateId: string }) => data.deckTemplateId === id), anchor = personal.cadenceAnchorDate;
  expect(personal.activeCardId).toBeNull(); expect(anchor).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  await page.keyboard.press("ArrowRight"); await page.keyboard.press("ArrowLeft");
  await expect(page.locator(".focused-card-layer")).toHaveCount(0); await page.reload(); await expect(page.locator(".deck-detail h1")).toHaveText(name);
  const dto = await (await page.request.get(`/api/decks-data/${id}`)).json(); expect(dto.cards).toEqual([]);
  await page.getByRole("button", { name: "Archive Deck", exact: true }).click(); await expect(page.getByRole("button", { name: `Open ${name}`, exact: true })).toHaveCount(0);
  await page.getByText("Archived decks", { exact: true }).click(); await page.getByRole("button", { name: `Restore ${name}`, exact: true }).click();
  await page.getByRole("button", { name: `Open ${name}`, exact: true }).click(); await page.getByRole("button", { name: "Deck menu", exact: true }).click();
  await page.getByRole("menuitem", { name: "Edit", exact: true }).click(); const cardId = await add(page);
  await column(page, cardId).locator(".creator-card-title-button").click(); await page.locator(".creator-modal textarea").fill("Later practice");
  await page.locator(".creator-modal").getByRole("button", { name: "Save", exact: true }).click();
  await column(page, cardId).getByRole("button", { name: "Publish Card 1", exact: true }).click();
  await expect.poll(async () => (await cardRoot(cardId))?.latestVersion).toBe(1);
  await expect(column(page, cardId).getByRole("button", { name: "Publish Card 1", exact: true })).toHaveText("Published");
  await expect(page.getByRole("button", { name: "Publish Deck", exact: true })).toBeEnabled(); await page.getByRole("button", { name: "Publish Deck", exact: true }).click();
  await expect.poll(async () => (await root(id))?.latestVersion).toBe(2);
  await page.getByRole("link", { name: "Deck", exact: true }).click(); await expect(page.locator(".deck-detail h1")).toHaveText(name);
  await expect(page.locator(".deck-card")).toHaveCount(1);
  expect((await page.request.post("/api/decks-data", { data: { deckTemplateId: id, localDate: "2028-01-01" } })).ok()).toBe(true);
  const reopened = await db().collection("users").findOne({ _id: actor() });
  expect(reopened!.decksData.find((data: { deckTemplateId: string }) => data.deckTemplateId === id).cadenceAnchorDate).toBe(anchor);
  expect(reopened!.cardsData.find((data: { cardTemplateId: string }) => data.cardTemplateId === cardId).targetDate).toBe(addDaysToDateOnly(anchor, 7));
});

test("publication controls distinguish defaults, blocked drafts and genuinely published clean content", async ({ page }) => {
  await open(page);
  const deck = page.getByRole("button", { name: "Publish Deck", exact: true });
  await expect(deck).toHaveCount(0); await expect(page.getByRole("button", { name: "Add note for Deck", exact: true })).toHaveCount(0);
  const id = await title(page, `Publication states ${randomUUID()}`);
  await expect(deck).toBeEnabled(); await expect(deck).not.toHaveClass(/creator-save-button--published/);
  const cardId = await add(page), cardPublish = column(page, cardId).getByRole("button", { name: "Publish Card 1", exact: true });
  await expect(cardPublish).toHaveCount(0); await expect(column(page, cardId).getByRole("button", { name: "Add note for Card 1", exact: true })).toHaveCount(0);
  await expect(deck.getByRole("img", { name: "Publication blocked" })).toBeVisible(); await expect(deck).not.toHaveClass(/creator-save-button--published/);
  await deck.click(); await expect(page.getByRole("dialog", { name: "Publication blocked" })).toContainText("published at least once");
  expect((await root(id))!.latestVersion).toBe(0); await page.keyboard.press("Escape"); await expect(deck).toBeFocused();
  await editStep(page, cardId, "Sparse content is valid");
  await expect(cardPublish.getByRole("img", { name: "Publication blocked" })).toBeVisible(); await cardPublish.click();
  await expect(page.getByRole("dialog", { name: "Publication blocked" })).toContainText("My Next Card");
  await page.getByRole("dialog", { name: "Publication blocked" }).getByRole("button", { name: "Close" }).click();
  await column(page, cardId).locator(".creator-card-date-button").click(); await expect(page.locator(".creator-modal-header")).toContainText("Suggested target date");
  await page.locator('.creator-modal input[type="date"]').fill("2027-03-14"); await page.locator(".creator-modal").getByRole("button", { name: "Save", exact: true }).click();
  await expect.poll(async () => (await cardRoot(cardId))!.draft.suggestedTargetDate).toBe("2027-03-14");
  const user = await db().collection("users").findOne({ _id: actor() }); expect(user!.cardsData.some((data: { cardTemplateId: string }) => data.cardTemplateId === cardId)).toBe(false);
  await column(page, cardId).locator(".creator-card-title-button").click(); await page.locator(".creator-modal textarea").fill("First publication");
  await page.locator(".creator-modal").getByRole("button", { name: "Save", exact: true }).click();
  await cardPublish.click(); await expect(cardPublish).toHaveText("Published");
  await deck.click(); await expect(deck).toHaveText("Published");
});

for (const succeeds of [true, false]) test(`return waits for attached upload/save; ${succeeds ? "success offers publication" : "failure stays"}`, async ({ page }) => {
  await open(page); const id = await title(page, `Normal leave ${randomUUID()}`), cardId = await add(page), pause = gate(); let started = false;
  await page.route(`${process.env.PHASE2_MEDIA_FIXTURE_ORIGIN}/upload`, async (route) => {
    started = true; await pause.promise;
    if (succeeds) await route.continue(); else await route.fulfill({ status: 500, body: "Fixture upload failure" });
  });
  await column(page, cardId).locator('.creator-card-intro-media-slot input[type="file"]').setInputFiles({ name: "leave.mp4", mimeType: "video/mp4", buffer: Buffer.from("fixture video") });
  await expect.poll(() => started).toBe(true); await page.getByRole("link", { name: "Decks", exact: true }).click();
  await expect(page.locator(".creator-navigation-status")).toContainText("Finishing saves and uploads");
  await expect(page.getByRole("dialog", { name: "Leave Creator confirmation" })).toHaveCount(0); await expect(page).toHaveURL(new RegExp(`/creator/edit/${id}$`));
  pause.resolve();
  if (succeeds) {
    await expect(page.getByRole("dialog", { name: "Leave Creator confirmation" })).toBeVisible();
    expect((await cardRoot(cardId))!.draft.intro.mediaItem.description).toBe("leave.mp4");
    await page.getByRole("button", { name: "Leave without publishing", exact: true }).click();
    await expect(page).toHaveURL(/\/decks$/); expect((await cardRoot(cardId))!.draft.intro.mediaItem.description).toBe("leave.mp4");
  } else {
    await expect(page.getByText("Current work could not be saved. Review the save or upload errors before leaving.")).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/creator/edit/${id}$`)); expect((await cardRoot(cardId))!.draft.intro.mediaItem).toBeNull();
  }
  expect((await root(id))!.latestVersion).toBe(0);
});

for (const status of [400, 409]) test(`normal leave retains failed/conflicted local edits (${status})`, async ({ page }) => {
  await open(page); const id = await title(page, `Stay ${randomUUID()}`), cardId = await add(page);
  await page.route(`**/api/card-templates/${cardId}`, async (route) => {
    if (route.request().method() === "PATCH") await route.fulfill({ status, json: { code: status === 409 ? "STALE_REVISION" : "INVALID_CONTENT" } }); else await route.continue();
  });
  await editStep(page, cardId, "Do not lose this"); await expect(page.locator(".creator-entity-save-error")).toBeVisible();
  await page.getByRole("link", { name: "Decks", exact: true }).click();
  await expect(page.getByText("Current work could not be saved. Review the save or upload errors before leaving.")).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Leave Creator confirmation" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Publish and leave", exact: true })).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`/creator/edit/${id}$`)); await expect(column(page, cardId)).toContainText("Do not lose this");
});

test("saved unpublished work offers publication only on return; Cancel and leave preserve drafts", async ({ page }) => {
  await open(page); const id = await title(page, `Saved leave ${randomUUID()}`);
  await page.getByRole("button", { name: "Edit deck title and introduction" }).click();
  await page.locator('.creator-modal input[type="file"][accept="video/*"]').setInputFiles({ name: "mock.mp4", mimeType: "video/mp4", buffer: Buffer.from("fixture video") });
  await expect(page.locator(".creator-modal")).toContainText("synthetic Stream ID");
  await expect.poll(async () => (await root(id))?.draft.introduction?.video.assetId.startsWith("fixture-")).toBe(true);
  await page.locator(".creator-modal").getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: "Publish and leave", exact: true })).toHaveCount(0);
  const back = page.getByRole("link", { name: "Decks", exact: true });
  await back.click(); const leave = page.getByRole("dialog", { name: "Leave Creator confirmation" });
  await expect(leave).toBeVisible(); await expect(leave.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
  await leave.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(leave).toHaveCount(0); await expect(back).toBeFocused(); await expect(page).toHaveURL(new RegExp(`/creator/edit/${id}$`));
  await expect(page.getByRole("button", { name: "Publish and leave", exact: true })).toHaveCount(0);
  await back.click(); await page.keyboard.press("Escape"); await expect(leave).toHaveCount(0); await expect(back).toBeFocused();
  await back.click(); await leave.getByRole("button", { name: "Leave without publishing", exact: true }).click(); await expect(page).toHaveURL(/\/decks$/);
  await expect(page.getByRole("button", { name: "Save drafts and leave" })).toHaveCount(0); expect((await root(id))!.latestVersion).toBe(0);
});

test("clean published work returns without a prompt; Card-only changes trigger the leave option", async ({ page }) => {
  await open(page); const id = await title(page, `Card-only leave ${randomUUID()}`), cardId = await add(page);
  await column(page, cardId).locator(".creator-card-title-button").click(); await page.locator(".creator-modal textarea").fill("Published Card");
  await page.locator(".creator-modal").getByRole("button", { name: "Save", exact: true }).click();
  const publishCard = column(page, cardId).getByRole("button", { name: "Publish Card 1", exact: true });
  await expect(publishCard).toBeEnabled(); await publishCard.click(); await expect(publishCard).toHaveText("Published");
  const publishDeck = page.getByRole("button", { name: "Publish Deck", exact: true });
  await expect(publishDeck).toBeEnabled(); await publishDeck.click(); await expect(publishDeck).toHaveText("Published");
  await page.getByRole("link", { name: "Decks", exact: true }).click(); await expect(page).toHaveURL(/\/decks$/);
  await expect(page.getByRole("dialog", { name: "Leave Creator confirmation" })).toHaveCount(0);
  await page.goto(`/creator/edit/${id}`); await editStep(page, cardId, "Only the Card changed");
  await expect(publishCard).toHaveText("Publish"); await expect(publishDeck).toHaveText("Published");
  await expect(page.getByRole("button", { name: "Publish and leave", exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "Decks", exact: true }).click();
  const leave = page.getByRole("dialog", { name: "Leave Creator confirmation" }); await expect(leave).toBeVisible();
  await leave.getByRole("button", { name: "Publish and leave", exact: true }).click(); await expect(page).toHaveURL(/\/decks$/);
  expect((await root(id))!.latestVersion).toBe(1); expect((await cardRoot(cardId))!.latestVersion).toBe(2);
});

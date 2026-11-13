import { expect, test, type Page } from "@playwright/test";
import { MongoClient, ObjectId } from "mongodb";
import { randomUUID } from "node:crypto";
import { CardRepository } from "../../src/lib/cards/repository";
import { InfoCardRepository } from "../../src/lib/infoCards/repository";
import { GroupExperienceRepository } from "../../src/lib/groupExperiences/repository";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";
import { createDefaultCardContent, createDefaultDeckContent } from "../../src/lib/cards/creatorDefaults";

// Info Cards inside Group Experiences, on the disposable database only (run with --info-cards).
// Checkpoint 4.1: Creator Info Cards appear in every Group perspective, and a standalone Personal Info Card
// never reaches another user or the Group and Other followers perspectives.
// Checkpoint 4.2: Me shows and creates the viewer own Follower contribution Info Cards, with the media
// visibility indicator; the standalone Card shows them too; nobody else sees them before checkpoint 4.3.
let client: MongoClient;
test.beforeAll(async () => { assertDisposableDatabase(); client = await new MongoClient(process.env.MONGODB_URI!).connect(); });
test.afterAll(async () => { await client?.close(); });

const CREATOR_CARDS = ["demo-owner-public", "demo-other-public"];
async function fixture() {
  const main = new CardRepository(client.db(process.env.MONGODB_DB!), client), owner = process.env.PHASE2_USER_ID!;
  const other = (await main.users().findOne({ username: "other" }))!._id.toString();
  const info = new InfoCardRepository(main.db, client), groups = new GroupExperienceRepository(main);
  const card = await main.createCardDraft(owner, { ...createDefaultCardContent([randomUUID(), randomUUID(), randomUUID()]),
    intro: { title: "Group practice", description: "Shared instruction.", mediaItem: null }, infoCardIds: CREATOR_CARDS }, "public");
  await main.publishCard(owner, card.cardTemplateId, 0);
  const deck = await main.createDeckDraft(owner, { ...createDefaultDeckContent([]), title: "Group programme", cards: [{ cardTemplateId: card.cardTemplateId }] }, "public");
  await main.publishDeck(owner, deck.deckTemplateId, 0);
  // The owner also holds the Card in a standalone Deck, with a standalone Personal Info Card on it.
  await main.ensureDeckData(owner, deck.deckTemplateId, 1);
  const noteId = randomUUID(), context = { deckTemplateId: deck.deckTemplateId, version: 1, personalInfoRevision: 0 };
  await info.createPersonal(owner, noteId, card.cardTemplateId, context);
  await info.save(owner, noteId, 0, { title: "Standalone note", body: "Only mine.", seriesId: "demo-series-owner", mediaItem: null }, "private");
  await info.savePersonal(owner, noteId, 1, context);
  // The owner administers the Group and also follows it (dual role); "other" follows it.
  const experience = await groups.create(owner, { operationId: randomUUID(), name: "Info squad", adminIds: [], followerIds: [owner, other],
    manifest: { deckTemplateId: deck.deckTemplateId, deckVersion: 1, cards: [{ cardTemplateId: card.cardTemplateId, version: 1 }] } });
  await groups.saveSettings(owner, experience.experienceId, { operationId: randomUUID(), expectedStructureRevision: 0, allowFollowerInspection: true });
  // A second Group with the same Card, where the owner already saved a Follower contribution.
  const second = await groups.create(owner, { operationId: randomUUID(), name: "Other squad", adminIds: [], followerIds: [owner, other],
    manifest: { deckTemplateId: deck.deckTemplateId, deckVersion: 1, cards: [{ cardTemplateId: card.cardTemplateId, version: 1 }] } });
  const elsewhereId = randomUUID();
  await info.createGroup(owner, elsewhereId, second.experienceId, card.cardTemplateId, { accessEpoch: 0, version: 1, creationContext: "self" });
  await info.save(owner, elsewhereId, 0, { title: "From the other squad", body: "Saved in the other Group.", seriesId: "demo-series-owner", mediaItem: null }, "private");
  await info.savePersonal(owner, elsewhereId, 1);
  return { main, info, groups, owner, other, noteId, elsewhereId, deckId: deck.deckTemplateId, cardId: card.cardTemplateId, experienceId: experience.experienceId, secondId: second.experienceId };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
async function login(page: Page, username = "phase2") {
  expect((await page.request.post("/api/auth/login", { data: { identifier: username, password: "local-test-only" } })).ok()).toBeTruthy();
}
async function select(page: Page, f: Fixture, selection: { perspective: "group" | "self" } | { perspective: "follower"; subjectUserId: string }) {
  const current = await (await page.request.get(`/api/group-experiences/${f.experienceId}`)).json();
  expect((await page.request.patch(`/api/group-experiences/${f.experienceId}/navigation`, { data: { accessEpoch: current.accessEpoch,
    expectedStructureRevision: current.structureRevision, activeCardId: f.cardId, selection } })).ok()).toBeTruthy();
}
// Opens the pouch and returns the ids of the Info Cards in the consultation snapshot the page received; only the
// current card is in the DOM, so the snapshot is what the stack holds.
async function openPouch(page: Page, f: Fixture, path = `/decks?openExperience=${f.experienceId}`) {
  const entries = await openPouchEntries(page, f, path);
  return entries.map(entry => entry.info?.infoCardId ?? entry.status).toSorted();
}
type Entry = { status: string; source?: string; private?: boolean; info?: { infoCardId: string } };
async function openPouchEntries(page: Page, f: Fixture, path = `/decks?openExperience=${f.experienceId}`) {
  await page.goto(path);
  await page.locator(".deck-card.is-active").press("Enter");
  await page.locator(".focused-card-layer .active-card-identity").click();
  await expect(page.locator(".step-view-layer")).toHaveCount(1);
  const snapshot = page.waitForResponse(response => new URL(response.url()).pathname === `/api/card-templates/${f.cardId}/info-cards`);
  await page.getByRole("button", { name: /^Open information cards/ }).click();
  const body = await (await snapshot).json() as { entries: Entry[] };
  await expect(page.locator("[data-info-card-stack]")).toHaveAttribute("data-info-stack-phase", "open");
  return body.entries;
}
const editor = (page: Page) => page.getByRole("dialog", { name: "Personal Info Card editor", exact: true });
const current = (page: Page) => page.locator('[data-info-card-current="true"]');
async function menu(page: Page) {
  await current(page).getByRole("button", { name: "Info Card actions", exact: true }).click();
  const items = await page.getByRole("menuitem").allTextContents();
  return items;
}
async function write(page: Page, title: string) {
  await expect(editor(page)).toBeVisible();
  const series = editor(page).getByRole("combobox", { name: "Series", exact: true });
  if (!(await series.textContent())?.includes("Basics (phase2)")) { await series.click(); await editor(page).getByRole("option", { name: "Basics (phase2)", exact: true }).click(); }
  await editor(page).getByRole("textbox", { name: "Title", exact: true }).fill(title);
  await editor(page).getByRole("textbox", { name: "Explanation", exact: true }).fill("Written in Me.");
  await editor(page).getByRole("button", { name: "Save", exact: true }).click();
  await expect(editor(page)).toHaveCount(0);
  await expect(page.locator("[data-info-card-stack]")).toHaveAttribute("data-info-stack-phase", "open");
}

for (const [label, viewer, selection] of [
  ["Group", "phase2", "group"], ["Other followers", "phase2", "inspect-other"],
  ["another follower in Group", "other", "group"], ["another follower inspecting the owner", "other", "inspect-owner"],
] as const) test(`Creator Info Cards appear in the ${label} perspective and the owner's standalone Personal Info Card does not`, async ({ page }) => {
  const f = await fixture(); await login(page, viewer);
  await select(page, f, selection === "group" ? { perspective: selection }
    : { perspective: "follower", subjectUserId: selection === "inspect-other" ? f.other : f.owner });
  expect(await openPouch(page, f)).toEqual(CREATOR_CARDS.toSorted());
  await expect(page.getByRole("button", { name: "Close information cards (2 attached)", exact: true })).toBeVisible();
  expect(CREATOR_CARDS).toContain(await page.locator('[data-info-card-current="true"]').getAttribute("data-info-card-id"));
  await expect(page.locator(`[data-info-card-id="${f.noteId}"]`)).toHaveCount(0);
  await expect(page.getByText("Standalone note")).toHaveCount(0);
});

test("Me shows Creator Info Cards and the viewer own notes; those not shared with this Group are private and read-only", async ({ page }) => {
  const f = await fixture(); await login(page);
  await select(page, f, { perspective: "self" });
  const entries = await openPouchEntries(page, f);
  const byId = new Map(entries.map(entry => [entry.info?.infoCardId, entry]));
  expect([...byId.keys()].toSorted()).toEqual([...CREATOR_CARDS, f.noteId, f.elsewhereId].toSorted());
  expect(byId.get(f.noteId)).toMatchObject({ source: "personal", private: true });
  expect(byId.get(f.elsewhereId)).toMatchObject({ source: "group", private: true });
  for (const id of CREATOR_CARDS) expect(byId.get(id)?.private).toBeUndefined();
  // The newest is the note from the other Group: Personal green, the eye-off indicator, and no Edit or Remove here.
  await expect(current(page)).toHaveAttribute("data-info-card-id", f.elsewhereId);
  await expect(current(page).locator("[data-info-card-face]")).toHaveAttribute("data-info-card-type", "personal");
  await expect(current(page).locator("[data-info-card-visibility]")).toHaveAttribute("data-info-card-visibility", "private");
  await expect(current(page).getByRole("img", { name: "Private in this Group", exact: true })).toHaveCount(1);
  expect(await menu(page)).toEqual(["+ New"]);
});

test("a follower creates, edits and removes a Group note from Me without touching CardData", async ({ page }) => {
  const f = await fixture(); await login(page);
  await select(page, f, { perspective: "self" });
  await openPouch(page, f);
  const before = JSON.stringify((await f.main.users().findOne({ _id: new ObjectId(f.owner) }))!.cardsData);
  expect(await menu(page)).toEqual(["+ New"]); await page.getByRole("menuitem", { name: "+ New", exact: true }).click();
  await write(page, "Squad note");
  // Saved as a Follower contribution of this Group and opened as the focused card, shared with this Group.
  const id = (await current(page).getAttribute("data-info-card-id"))!;
  const root = await f.info.owner(f.owner, id);
  expect(root).toMatchObject({ kind: "group", creationContext: "self", experienceId: f.experienceId, originCardTemplateId: f.cardId, groupVisible: true, latestVersion: 1 });
  await expect(current(page).locator("[data-info-card-title]")).toHaveText("Squad note");
  await expect(current(page).locator("[data-info-card-face]")).toHaveAttribute("data-info-card-type", "personal");
  await expect(current(page).getByRole("img", { name: "Visible to this Group", exact: true })).toHaveCount(1);
  expect(JSON.stringify((await f.main.users().findOne({ _id: new ObjectId(f.owner) }))!.cardsData)).toBe(before);
  // Its author edits it here, and Remove deletes it.
  expect(await menu(page)).toEqual(["+ New", "Edit", "Remove"]); await page.getByRole("menuitem", { name: "Edit", exact: true }).click();
  await write(page, "Squad note, edited");
  await expect(current(page)).toHaveAttribute("data-info-card-id", id);
  await expect(current(page).locator("[data-info-card-title]")).toHaveText("Squad note, edited");
  expect(await menu(page)).toEqual(["+ New", "Edit", "Remove"]); await page.getByRole("menuitem", { name: "Remove", exact: true }).click();
  await expect(page.locator(`[data-info-card-id="${id}"]`)).toHaveCount(0);
  expect((await f.info.roots().findOne({ infoCardId: id }))?.deletedAt).toBeInstanceOf(Date);
  expect(JSON.stringify((await f.main.users().findOne({ _id: new ObjectId(f.owner) }))!.cardsData)).toBe(before);
});

test("the standalone Card shows the owner's Group notes with Edit and Remove, and no visibility indicator", async ({ page }) => {
  const f = await fixture(); await login(page);
  const entries = await openPouchEntries(page, f, `/decks?openDeck=${f.deckId}`);
  expect(entries.map(entry => entry.info?.infoCardId).toSorted()).toEqual([...CREATOR_CARDS, f.noteId, f.elsewhereId].toSorted());
  expect(entries.every(entry => entry.private === undefined)).toBe(true);
  await expect(current(page)).toHaveAttribute("data-info-card-id", f.elsewhereId);
  await expect(current(page).locator("[data-info-card-visibility]")).toHaveCount(0);
  expect(await menu(page)).toEqual(["+ New", "Edit", "Remove"]);
});

test("nobody else sees a follower Group note: not the Group perspective, Other followers, or another user", async ({ page }) => {
  const f = await fixture();
  for (const [viewer, selection] of [["phase2", { perspective: "group" }], ["other", { perspective: "group" }], ["other", { perspective: "follower", subjectUserId: f.owner }], ["other", { perspective: "self" }]] as const) {
    await page.request.post("/api/auth/logout"); await login(page, viewer); await select(page, f, selection);
    const ids = await openPouch(page, f);
    expect(ids, `${viewer} ${selection.perspective}`).not.toContain(f.elsewhereId);
    expect(ids).not.toContain(f.noteId);
  }
  // Direct reads by another user are refused.
  expect((await page.request.get(`/api/info-cards/${f.elsewhereId}`)).status()).toBe(403);
});

test("the owner's standalone Personal Info Card is refused to another user through every Group-reachable read", async ({ page }) => {
  const f = await fixture(); await login(page, "other");
  expect((await page.request.get(`/api/info-cards/${f.noteId}`)).status()).toBe(403);
  expect((await page.request.get(`/api/info-cards/${f.noteId}/media?version=1`)).ok()).toBe(false);
  const canonical = await (await page.request.get(`/api/card-templates/${f.cardId}/info-cards?mode=canonical&version=1`, { headers: { "X-Personal-Viewer": f.other } })).json();
  expect(JSON.stringify(canonical)).not.toContain(f.noteId);
  expect(canonical.entries.map((entry: { info?: { infoCardId: string } }) => entry.info?.infoCardId).toSorted()).toEqual(CREATOR_CARDS.toSorted());
  // The owner's CardData still holds it, untouched by the Group.
  const user = await f.main.users().findOne({ _id: new ObjectId(f.owner) });
  expect(user!.cardsData.find(data => data.cardTemplateId === f.cardId)?.personalInfoCardIds).toEqual([f.noteId]);
});

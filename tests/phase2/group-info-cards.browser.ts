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
// Checkpoint 4.2b (C1, C3): Edit and Remove only in the creation context; elsewhere the menu names it beside
// + New. An unsaved Group draft reopens from My Drafts directly in the shared editor.
// Checkpoint 4.4: the Group perspective shows every contribution shared with the Group; admins create Group Admin
// Info Cards there, Edit and Remove their own, and Hide the others without deleting them.
// Checkpoint 4.5a (V1): Admin contributions also appear in every follower's Me of their Group, as Group content.
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
// The read-only origin of the open menu, or null when it has none.
async function menuOrigin(page: Page) {
  const origin = current(page).locator("[data-info-card-origin]");
  return await origin.count() ? (await origin.locator("span").allTextContents()) : null;
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
  expect(await menuOrigin(page)).toEqual(["Created in:", "Other squad · Me"]);
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
  // Its author edits it here, in its creation context, and Remove deletes it.
  expect(await menu(page)).toEqual(["+ New", "Edit", "Delete"]); expect(await menuOrigin(page)).toBeNull();
  await page.getByRole("menuitem", { name: "Edit", exact: true }).click();
  await write(page, "Squad note, edited");
  await expect(current(page)).toHaveAttribute("data-info-card-id", id);
  await expect(current(page).locator("[data-info-card-title]")).toHaveText("Squad note, edited");
  expect(await menu(page)).toEqual(["+ New", "Edit", "Delete"]); await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
  await expect(page.locator(`[data-info-card-id="${id}"]`)).toHaveCount(0);
  expect((await f.info.roots().findOne({ infoCardId: id }))?.deletedAt).toBeInstanceOf(Date);
  expect(JSON.stringify((await f.main.users().findOne({ _id: new ObjectId(f.owner) }))!.cardsData)).toBe(before);
});

test("the standalone Card shows the owner's Group notes read-only with their origin, and no visibility indicator", async ({ page }) => {
  const f = await fixture(); await login(page);
  const entries = await openPouchEntries(page, f, `/decks?openDeck=${f.deckId}`);
  expect(entries.map(entry => entry.info?.infoCardId).toSorted()).toEqual([...CREATOR_CARDS, f.noteId, f.elsewhereId].toSorted());
  expect(entries.every(entry => entry.private === undefined)).toBe(true);
  await expect(current(page)).toHaveAttribute("data-info-card-id", f.elsewhereId);
  await expect(current(page).locator("[data-info-card-visibility]")).toHaveCount(0);
  // C1: a Group note is edited only in Me of its Group; here the menu names it beside + New.
  expect(await menu(page)).toEqual(["+ New"]);
  expect(await menuOrigin(page)).toEqual(["Created in:", "Other squad · Me"]);
});

test("a long Group name in the menu origin wraps inside the card at phone width, without clipping", async ({ page }) => {
  const f = await fixture(); await login(page); await page.setViewportSize({ width: 320, height: 640 });
  const name = "Under fourteen development squad, Saturday morning extended practice group";
  const long = await f.groups.create(f.owner, { operationId: randomUUID(), name, adminIds: [], followerIds: [f.owner],
    manifest: { deckTemplateId: f.deckId, deckVersion: 1, cards: [{ cardTemplateId: f.cardId, version: 1 }] } });
  const id = randomUUID();
  await f.info.createGroup(f.owner, id, long.experienceId, f.cardId, { accessEpoch: 0, version: 1, creationContext: "self" });
  await f.info.save(f.owner, id, 0, { title: "From the long squad", body: "Saved there.", seriesId: "demo-series-owner", mediaItem: null }, "private");
  await f.info.savePersonal(f.owner, id, 1);
  await select(page, f, { perspective: "self" });
  await openPouch(page, f);
  await expect(current(page)).toHaveAttribute("data-info-card-id", id);
  expect(await menu(page)).toEqual(["+ New"]);
  const origin = current(page).locator("[data-info-card-origin]");
  await expect(origin).toContainText(`${name} · Me`);
  const [box, card] = [(await origin.boundingBox())!, (await current(page).boundingBox())!];
  expect(box.x).toBeGreaterThanOrEqual(card.x - 0.5); expect(box.x + box.width).toBeLessThanOrEqual(card.x + card.width + 0.5);
  expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(320);
  expect(box.height, "the name wraps onto several lines").toBeGreaterThan(30);
  expect(await origin.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
});

test("an unsaved Group draft reopens from My Drafts directly in the editor, names its origin, and stays open on Saved.", async ({ page }) => {
  const f = await fixture(); await login(page);
  const id = randomUUID();
  await f.info.createGroup(f.owner, id, f.experienceId, f.cardId, { accessEpoch: 0, version: 1, creationContext: "self" });
  await f.info.save(f.owner, id, 0, { title: "Unfinished squad note", body: "Started in Me.", seriesId: "demo-series-owner", mediaItem: null }, "private");
  // A saved Group note with an unsaved edit is continued in its creation context, never from My Drafts.
  await f.info.save(f.owner, f.elsewhereId, 2, { title: "From the other squad, edited", body: "Edited in the other Group.", seriesId: "demo-series-owner", mediaItem: null }, "private");
  await page.goto("/creator/new");
  await page.getByRole("button", { name: "My Drafts", exact: true }).click();
  const drafts = page.getByRole("dialog", { name: "My Drafts", exact: true });
  const entry = drafts.getByRole("button", { name: /Unfinished squad note/ });
  await expect(entry).toContainText("Created in: Info squad · Me");
  await expect(drafts.getByRole("button", { name: /From the other squad/ })).toHaveCount(0);
  await entry.click();
  await expect(page).toHaveURL(new RegExp(`/creator/info-cards/${id}`));
  await expect(page.locator("[data-info-draft-origin]")).toHaveText("Created in: Info squad · Me");
  await expect(page.getByRole("textbox", { name: "Title", exact: true })).toHaveValue("Unfinished squad note");
  // Autosave continues the draft, authorised against its Group.
  await page.getByRole("textbox", { name: "Explanation", exact: true }).fill("Finished from My Drafts.");
  await expect(page.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible();
  expect((await f.info.owner(f.owner, id)).draft?.body).toBe("Finished from My Drafts.");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved.", { exact: true })).toBeVisible(); await expect(page).toHaveURL(new RegExp(`/creator/info-cards/${id}`));
  const saved = await f.info.owner(f.owner, id);
  expect(saved).toMatchObject({ kind: "group", experienceId: f.experienceId, creationContext: "self", latestVersion: 1, draft: null });
  await page.goto("/creator/new?drafts=1");
  await expect(page.getByRole("dialog", { name: "My Drafts", exact: true }).getByRole("button", { name: /Unfinished squad note/ })).toHaveCount(0);
  // Once saved, the Creator route no longer opens it for editing.
  await page.goto(`/creator/info-cards/${id}`);
  await expect(page.getByText("Info Card unavailable.")).toBeVisible();
  await expect(page.locator("[data-info-draft-origin]")).toHaveText("Created in: Info squad · Me");
  await expect(page.getByRole("textbox", { name: "Title", exact: true })).toHaveCount(0);
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

// A saved contribution of this fixture, made directly as its creation perspective would make it.
async function contribution(f: Fixture, actor: string, creationContext: "self" | "group", title: string, experienceId = f.experienceId) {
  const id = randomUUID(), member = (await f.groups.members().findOne({ experienceId, userId: actor }))!;
  await f.info.createGroup(actor, id, experienceId, f.cardId, { accessEpoch: member.accessEpoch, version: 1, creationContext });
  await f.info.save(actor, id, 0, { title, body: "Shared with the squad.", seriesId: actor === f.owner ? "demo-series-owner" : "demo-series-other", mediaItem: null }, "private");
  await f.info.savePersonal(actor, id, 1);
  return id;
}
// Browses the open stack with its existing ArrowDown key until the given card is current.
async function showCard(page: Page, id: string) {
  for (let turn = 0; turn < 8 && await current(page).getAttribute("data-info-card-id") !== id; turn++) {
    const before = await current(page).getAttribute("data-info-card-id");
    await page.locator("[data-info-card-stack]").dispatchEvent("keydown", { key: "ArrowDown", bubbles: true });
    await expect.poll(() => current(page).getAttribute("data-info-card-id")).not.toBe(before);
    await expect(page.locator("[data-info-card-layer]")).toHaveCount(1);
  }
  await expect(current(page)).toHaveAttribute("data-info-card-id", id);
}
const actions = (page: Page) => current(page).getByRole("button", { name: "Info Card actions", exact: true });

test("an admin creates, edits and removes a Group Admin Info Card in the Group perspective, in teal and never in CardData", async ({ page }) => {
  const f = await fixture(); await login(page);
  await select(page, f, { perspective: "group" });
  await openPouch(page, f);
  const before = JSON.stringify((await f.main.users().findOne({ _id: new ObjectId(f.owner) }))!.cardsData);
  // + New is offered on a Creator Info Card, where the admin may create.
  expect(await menu(page)).toEqual(["+ New"]); await page.getByRole("menuitem", { name: "+ New", exact: true }).click();
  await write(page, "Squad plan");
  const id = (await current(page).getAttribute("data-info-card-id"))!;
  expect(await f.info.owner(f.owner, id)).toMatchObject({ kind: "group", creationContext: "group", experienceId: f.experienceId, latestVersion: 1 });
  await expect(current(page).locator("[data-info-card-face]")).toHaveAttribute("data-info-card-type", "groupAdmin");
  await expect(current(page).locator("[data-info-card-type-label]")).toHaveText("Group");
  expect(JSON.stringify((await f.main.users().findOne({ _id: new ObjectId(f.owner) }))!.cardsData)).toBe(before);
  // In its creation context the author edits and removes it; Remove is permanent.
  expect(await menu(page)).toEqual(["+ New", "Edit", "Delete"]); expect(await menuOrigin(page)).toBeNull();
  await page.getByRole("menuitem", { name: "Edit", exact: true }).click();
  await write(page, "Squad plan, edited");
  await expect(current(page).locator("[data-info-card-title]")).toHaveText("Squad plan, edited");
  expect(await menu(page)).toEqual(["+ New", "Edit", "Delete"]); await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
  await expect(page.locator(`[data-info-card-id="${id}"]`)).toHaveCount(0);
  expect((await f.info.roots().findOne({ infoCardId: id }))?.deletedAt).toBeInstanceOf(Date);
});

test("the Group perspective shows contributions shared with the Group; a follower has no menu on others' cards", async ({ page }) => {
  const f = await fixture();
  const admin = await contribution(f, f.owner, "group", "Admin note"), follower = await contribution(f, f.other, "self", "Other note");
  const elsewhere = await contribution(f, f.owner, "group", "Admin note elsewhere", f.secondId);
  await login(page, "other"); await select(page, f, { perspective: "group" });
  // The closed pouch counts the Group's contributions with the Creator Info Cards.
  await page.goto(`/decks?openExperience=${f.experienceId}`);
  await page.locator(".deck-card.is-active").press("Enter"); await page.locator(".focused-card-layer .active-card-identity").click();
  await expect(page.getByRole("button", { name: "Open information cards (4 attached)", exact: true })).toBeVisible();
  const ids = await openPouch(page, f);
  expect(ids).toEqual([...CREATOR_CARDS, admin, follower].toSorted());
  expect(ids).not.toContain(elsewhere); expect(ids).not.toContain(f.noteId);
  await showCard(page, admin);
  await expect(current(page).locator("[data-info-card-face]")).toHaveAttribute("data-info-card-type", "groupAdmin");
  await expect(actions(page)).toHaveCount(0);
  // Their own Follower contribution shows where it was created; nothing else, as they cannot create here.
  await showCard(page, follower);
  await expect(current(page).locator("[data-info-card-face]")).toHaveAttribute("data-info-card-type", "personal");
  expect(await menu(page)).toEqual([]); expect(await menuOrigin(page)).toEqual(["Created in:", "Info squad · Me"]);
});

test("an admin hides a follower contribution, and their own Follower one with its origin, without deleting either", async ({ page }) => {
  const f = await fixture();
  const theirs = await contribution(f, f.other, "self", "Other note"), mine = await contribution(f, f.owner, "self", "My follower note");
  await login(page); await select(page, f, { perspective: "group" });
  await openPouch(page, f);
  await showCard(page, mine);
  expect(await menu(page)).toEqual(["+ New", "Hide from Group"]); expect(await menuOrigin(page)).toEqual(["Created in:", "Info squad · Me"]);
  await page.getByRole("menuitem", { name: "Hide from Group", exact: true }).click();
  await expect(page.locator(`[data-info-card-id="${mine}"]`)).toHaveCount(0);
  await showCard(page, theirs);
  expect(await menu(page)).toEqual(["+ New", "Hide from Group"]); expect(await menuOrigin(page)).toBeNull();
  await page.getByRole("menuitem", { name: "Hide from Group", exact: true }).click();
  await expect(page.locator(`[data-info-card-id="${theirs}"]`)).toHaveCount(0);
  for (const [owner, id] of [[f.owner, mine], [f.other, theirs]] as const) {
    const root = await f.info.owner(owner, id);
    expect(root.groupVisible).toBe(false); expect(root.deletedAt).toBeUndefined(); expect(root.latestVersion).toBe(1);
  }
  // The author still has a hidden contribution in Me, marked private, and edits it there.
  await select(page, f, { perspective: "self" });
  const entries = await openPouchEntries(page, f);
  expect(entries.find(entry => entry.info?.infoCardId === mine)).toMatchObject({ source: "group", private: true });
});

test("a dual-role admin keeps two identities apart: Admin cards managed only in the Group perspective, Follower cards edited in Me", async ({ page }) => {
  const f = await fixture();
  const admin = await contribution(f, f.owner, "group", "Admin note"), follower = await contribution(f, f.owner, "self", "Follower note");
  await login(page);
  await select(page, f, { perspective: "self" });
  const me = await openPouch(page, f);
  expect(me).toContain(follower);
  await showCard(page, follower);
  expect(await menu(page)).toEqual(["+ New", "Edit", "Delete"]);
  await page.keyboard.press("Escape");
  // Since V1 the Admin card also appears in Me as Group content: its origin and + New, never Edit or Delete (C1).
  expect(me).toContain(admin);
  await showCard(page, admin);
  await expect(current(page).locator("[data-info-card-face]")).toHaveAttribute("data-info-card-type", "groupAdmin");
  expect(await menu(page)).toEqual(["+ New"]); expect(await menuOrigin(page)).toEqual(["Created in:", "Info squad · Group"]);
  // The standalone Card and the other Group never show the Admin card.
  expect(await openPouch(page, f, `/decks?openDeck=${f.deckId}`)).not.toContain(admin);
  const current2 = await (await page.request.get(`/api/group-experiences/${f.secondId}`)).json();
  expect((await page.request.patch(`/api/group-experiences/${f.secondId}/navigation`, { data: { accessEpoch: current2.accessEpoch,
    expectedStructureRevision: current2.structureRevision, activeCardId: f.cardId, selection: { perspective: "group" } } })).ok()).toBeTruthy();
  expect(await openPouch(page, f, `/decks?openExperience=${f.secondId}`)).not.toContain(admin);
});

test("a follower's Me shows the Group's Admin cards in teal, counted in the pouch, with + New only and no visibility indicator", async ({ page }) => {
  const f = await fixture();
  const admin = await contribution(f, f.owner, "group", "Admin note"), hidden = await contribution(f, f.owner, "group", "Hidden admin note");
  const elsewhere = await contribution(f, f.owner, "group", "Admin note elsewhere", f.secondId);
  const epoch = (await f.groups.members().findOne({ experienceId: f.experienceId, userId: f.owner }))!.accessEpoch;
  await f.info.hideGroup(f.owner, f.experienceId, hidden, epoch);
  await login(page, "other"); await select(page, f, { perspective: "self" });
  // The closed pouch counts the Admin card with the Creator Info Cards.
  await page.goto(`/decks?openExperience=${f.experienceId}`);
  await page.locator(".deck-card.is-active").press("Enter"); await page.locator(".focused-card-layer .active-card-identity").click();
  await expect(page.getByRole("button", { name: "Open information cards (3 attached)", exact: true })).toBeVisible();
  const entries = await openPouchEntries(page, f);
  const ids = entries.map(entry => entry.info?.infoCardId).toSorted();
  expect(ids).toEqual([...CREATOR_CARDS, admin].toSorted());
  expect(ids).not.toContain(hidden); expect(ids).not.toContain(elsewhere);
  expect(entries.find(entry => entry.info?.infoCardId === admin)).toMatchObject({ source: "group" });
  expect(entries.find(entry => entry.info?.infoCardId === admin)?.private).toBeUndefined();
  await showCard(page, admin);
  await expect(current(page).locator("[data-info-card-face]")).toHaveAttribute("data-info-card-type", "groupAdmin");
  await expect(current(page).locator("[data-info-card-visibility]")).toHaveCount(0);
  expect(await menu(page)).toEqual(["+ New"]); expect(await menuOrigin(page)).toBeNull();
});

test("Other followers shows only the inspected follower's shared contributions; an admin may hide them", async ({ page }) => {
  const f = await fixture();
  const theirs = await contribution(f, f.other, "self", "Other note"), admin = await contribution(f, f.owner, "group", "Admin note");
  await login(page); await select(page, f, { perspective: "follower", subjectUserId: f.other });
  const ids = await openPouch(page, f);
  expect(ids).toEqual([...CREATOR_CARDS, theirs].toSorted()); expect(ids).not.toContain(admin);
  await showCard(page, theirs);
  expect(await menu(page)).toEqual(["Hide from Group"]);
});

test("an unsaved Group Admin draft reopens from My Drafts as a Group draft, and saving keeps the editor open on Saved.", async ({ page }) => {
  const f = await fixture(); await login(page);
  const id = randomUUID(), member = (await f.groups.members().findOne({ experienceId: f.experienceId, userId: f.owner }))!;
  await f.info.createGroup(f.owner, id, f.experienceId, f.cardId, { accessEpoch: member.accessEpoch, version: 1, creationContext: "group" });
  await f.info.save(f.owner, id, 0, { title: "Unfinished squad plan", body: "Started in the Group perspective.", seriesId: "demo-series-owner", mediaItem: null }, "private");
  await page.goto("/creator/new");
  await page.getByRole("button", { name: "My Drafts", exact: true }).click();
  const entry = page.getByRole("dialog", { name: "My Drafts", exact: true }).getByRole("button", { name: /Unfinished squad plan/ });
  await expect(entry).toContainText("Created in: Info squad · Group");
  await entry.click();
  await expect(page).toHaveURL(new RegExp(`/creator/info-cards/${id}`));
  await expect(page.locator("[data-info-draft-origin]")).toHaveText("Created in: Info squad · Group");
  await expect(page.locator("[data-info-card-face]")).toHaveAttribute("data-info-card-type", "groupAdmin");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved.", { exact: true })).toBeVisible(); await expect(page).toHaveURL(new RegExp(`/creator/info-cards/${id}`));
  expect(await f.info.owner(f.owner, id)).toMatchObject({ creationContext: "group", latestVersion: 1, draft: null });
  await page.goto(`/creator/info-cards/${id}`);
  await expect(page.getByText("Info Card unavailable.")).toBeVisible();
  await expect(page.locator("[data-info-draft-origin]")).toHaveText("Created in: Info squad · Group");
});

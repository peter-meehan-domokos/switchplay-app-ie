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
  return { main, info, groups, owner, other, noteId, cardId: card.cardTemplateId, experienceId: experience.experienceId };
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
async function openPouch(page: Page, f: Fixture) {
  await page.goto(`/decks?openExperience=${f.experienceId}`);
  await page.locator(".deck-card.is-active").press("Enter");
  await page.locator(".focused-card-layer .active-card-identity").click();
  await expect(page.locator(".step-view-layer")).toHaveCount(1);
  const snapshot = page.waitForResponse(response => new URL(response.url()).pathname === `/api/card-templates/${f.cardId}/info-cards`);
  await page.getByRole("button", { name: /^Open information cards/ }).click();
  const body = await (await snapshot).json() as { entries: { status: string; info?: { infoCardId: string } }[] };
  await expect(page.locator("[data-info-card-stack]")).toHaveAttribute("data-info-stack-phase", "open");
  return body.entries.map(entry => entry.info?.infoCardId ?? entry.status).toSorted();
}

for (const [label, viewer, selection] of [
  ["Group", "phase2", "group"], ["Me", "phase2", "self"], ["Other followers", "phase2", "inspect-other"],
  ["another follower in Group", "other", "group"], ["another follower inspecting the owner", "other", "inspect-owner"],
] as const) test(`Creator Info Cards appear in the ${label} perspective and the owner's standalone Personal Info Card does not`, async ({ page }) => {
  const f = await fixture(); await login(page, viewer);
  await select(page, f, selection === "group" || selection === "self" ? { perspective: selection }
    : { perspective: "follower", subjectUserId: selection === "inspect-other" ? f.other : f.owner });
  expect(await openPouch(page, f)).toEqual(CREATOR_CARDS.toSorted());
  await expect(page.getByRole("button", { name: "Close information cards (2 attached)", exact: true })).toBeVisible();
  expect(CREATOR_CARDS).toContain(await page.locator('[data-info-card-current="true"]').getAttribute("data-info-card-id"));
  await expect(page.locator(`[data-info-card-id="${f.noteId}"]`)).toHaveCount(0);
  await expect(page.getByText("Standalone note")).toHaveCount(0);
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

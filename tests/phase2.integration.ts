import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { randomUUID } from "node:crypto";
import { MongoClient } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { CardRepository, createFoundationIndexes } from "../src/lib/cards/repository";
import { createStep } from "../src/lib/cards/domain";
import { membershipDTO, workingDTO } from "../src/lib/cards/readModels";
import { creatorDrafts } from "../src/lib/cards/creatorDrafts";
import { createDefaultCardContent, createDefaultDeckContent } from "../src/lib/cards/creatorDefaults";
import { buildDeckLayout } from "../src/components/decks/deckLayout";
import { authorizeUpload } from "../src/lib/cards/uploadAuthorization";
import { validateNewPersonalImage } from "../src/lib/cards/media";
import type { CardContent, DeckContent } from "../src/lib/cards/model";
let server: MongoMemoryReplSet, client: MongoClient, sequence = 0;
before(async () => { server = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } }); client = await new MongoClient(server.getUri()).connect(); });
after(async () => { await client?.close(); await server?.stop(); });
async function setup() {
  const db = client.db(`switchplay_phase2_integration_${sequence++}`); await createFoundationIndexes(db);
  const repo = new CardRepository(db, client);
  await repo.users().insertMany(["alice", "bob"].map((_id) => ({ _id, decksData: [], cardsData: [], sharedDeckData: [{ parked: "unchanged" }] })));
  const cards = [0, 1].map(() => ({ cardTemplateId: randomUUID(), content: { intro: { title: "Practice", description: null, mediaItem: null },
    suggestedTargetDate: "", steps: [createStep("One"), createStep("Two"), createStep("Three")] } satisfies CardContent }));
  const content: DeckContent = { title: "Private", introduction: null, categories: [], themes: [], cadence: { intervalDays: 7 }, labelPrefix: "Card", cards: cards.map(({ cardTemplateId }) => ({ cardTemplateId })) };
  const id = randomUUID(); return { repo, id, cards, content };
}
async function published() {
  const state = await setup(); const { repo, id, cards, content } = state;
  await repo.createPrivateGraph("alice", id, content, cards);
  for (const card of cards) await repo.publishCard("alice", card.cardTemplateId, 0);
  await repo.publishDeck("alice", id, 0); return state;
}
test("first graph save is atomic and idempotent; membership is explicit and creates no CardData", async () => {
  const { repo, id, cards, content } = await setup();
  await repo.createPrivateGraph("alice", id, content, cards); await repo.createPrivateGraph("alice", id, content, cards);
  assert.equal(await repo.cards().countDocuments(), 2); assert.equal(await repo.decks().countDocuments(), 1);
  const user = (await repo.getPersonalUser("alice"))!;
  assert.equal(user.cardsData.length, 0); assert.equal(user.decksData.length, 1); assert.equal(user.decksData[0].deckTemplateVersion, null);
  assert.deepEqual(await membershipDTO(repo, "alice"), []);
  await repo.users().updateOne({ _id: "alice" }, { $set: { decksData: [] } });
  assert.deepEqual(await membershipDTO(repo, "alice"), []);
});

test("My Drafts is read-only, owner-scoped and includes default persisted work independently of null adoption/archive", async () => {
  const { repo, id } = await setup();
  assert.deepEqual(await creatorDrafts(repo, "alice"), []);
  const content = createDefaultDeckContent([]);
  await repo.createPrivateGraph("alice", id, content, []);
  await repo.archiveDeckData("alice", id);
  const before = await repo.getPersonalUser("alice");
  const roots = await repo.decks().find().toArray();
  const list = await creatorDrafts(repo, "alice");
  assert.deepEqual(list.map(({ deckTemplateId, title, status }) => ({ deckTemplateId, title, status })), [{ deckTemplateId: id, title: "My Next Path", status: "unpublished" }]);
  assert.deepEqual(Object.keys(list[0]).sort(), ["deckTemplateId", "status", "title", "updatedAt"]);
  assert.deepEqual(await membershipDTO(repo, "alice"), []);
  assert.deepEqual(await creatorDrafts(repo, "bob"), []);
  assert.deepEqual(await repo.getPersonalUser("alice"), before);
  assert.deepEqual(await repo.decks().find().toArray(), roots);
  await repo.reactivateDeckData("alice", id);
  assert.deepEqual(await membershipDTO(repo, "alice"), []);
  assert.equal((await repo.getPersonalUser("alice"))!.decksData[0].deckTemplateVersion, null);
  await repo.users().updateOne({ _id: "alice" }, { $set: { decksData: [] } });
  assert.equal((await creatorDrafts(repo, "alice"))[0].deckTemplateId, id);
});

test("My Drafts includes Deck or referenced owned Card drafts, while My Decks retains adopted content", async () => {
  const { repo, id, content, cards } = await published();
  assert.deepEqual(await creatorDrafts(repo, "alice"), []);
  await repo.saveDeckDraft("alice", id, 1, { ...content, title: "Unpublished Deck change" });
  assert.equal((await creatorDrafts(repo, "alice"))[0].status, "deck-draft");
  assert.equal((await membershipDTO(repo, "alice"))[0].title, "Private");
  await repo.archiveDeckData("alice", id);
  assert.equal((await creatorDrafts(repo, "alice"))[0].status, "deck-draft");
  await repo.saveDeckDraft("alice", id, 2, content);
  assert.deepEqual(await creatorDrafts(repo, "alice"), []);
  await repo.saveCardDraft("alice", cards[0].cardTemplateId, 1, { ...cards[0].content, intro: { ...cards[0].content.intro, title: "Unpublished Card change" } });
  assert.equal((await creatorDrafts(repo, "alice"))[0].status, "card-drafts");
  const listing = await membershipDTO(repo, "alice");
  assert.equal(listing[0].display!.cards[0].intro.title, "Practice");
  assert.equal(listing[0].adoptedVersion, 1);
  assert.notEqual(listing[0].archivedAt, null);
  await repo.saveDeckDraft("alice", id, 3, { ...content, cards: content.cards.slice(1) });
  await repo.publishDeck("alice", id, 4);
  assert.deepEqual(await creatorDrafts(repo, "alice"), []); // detached Card still has its draft
  assert.notEqual((await repo.cards().findOne({ cardTemplateId: cards[0].cardTemplateId }))!.draft, null);
});

test("foreign Card drafts and unreferenced owned Card drafts do not add clean Decks to My Drafts", async () => {
  const { repo, cards, content } = await setup();
  const foreign = await repo.createCardDraft("bob", cards[0].content, "public");
  await repo.publishCard("bob", foreign.cardTemplateId, 0);
  const deck = await repo.createDeckDraft("alice", { ...content, cards: [{ cardTemplateId: foreign.cardTemplateId }] });
  await repo.publishDeck("alice", deck.deckTemplateId, 0);
  await repo.saveCardDraft("bob", foreign.cardTemplateId, 1, { ...cards[0].content, suggestedTargetDate: "2027-01-01" });
  await repo.createCardDraft("alice", cards[1].content);
  assert.deepEqual(await creatorDrafts(repo, "alice"), []);
  await repo.users().updateOne({ _id: "alice" }, { $set: { decksData: [] } });
  assert.deepEqual(await membershipDTO(repo, "alice"), []); // ownership is not membership
});

test("empty working Deck opens/reopens with null active identity and retains its anchor after later Card addition", async () => {
  const { repo, id, cards } = await setup();
  const content = { ...createDefaultDeckContent([]), title: "Empty working Deck" };
  await repo.createPrivateGraph("alice", id, content, []); await repo.publishDeck("alice", id, 0);
  await repo.openWorkingDeck("alice", id, "2026-10-04");
  await repo.openWorkingDeck("alice", id, "2026-12-25");
  const dto = await workingDTO(repo, "alice", id), layout = buildDeckLayout(dto, { currentUserId: "alice", users: [] });
  assert.deepEqual(dto.cards, []); assert.equal(layout.progressPercentage, 0); assert.equal(layout.confidenceScore, null);
  assert.equal((await repo.getPersonalUser("alice"))!.decksData[0].activeCardId, null);
  assert.equal((await repo.getPersonalUser("alice"))!.cardsData.length, 0);
  await assert.rejects(repo.setActiveCard("alice", id, "missing"));
  await repo.archiveDeckData("alice", id); await repo.reactivateDeckData("alice", id);
  const cardTemplateId = cards[0].cardTemplateId, stepIds = cards[0].content.steps.map((step) => step.stepId);
  await repo.createAndAttachCard("alice", { deckTemplateId: id, expectedDeckRevision: 1, cardTemplateId, stepIds,
    nextDeckContent: { ...content, cards: [{ cardTemplateId }] } });
  await repo.saveCardDraft("alice", cardTemplateId, 0, { ...createDefaultCardContent(stepIds), intro: { title: "Later Card", description: null, mediaItem: null } });
  await repo.publishCard("alice", cardTemplateId, 1); await repo.publishDeck("alice", id, 2);
  await repo.openWorkingDeck("alice", id, "2028-01-01");
  const user = (await repo.getPersonalUser("alice"))!;
  assert.equal(user.decksData[0].cadenceAnchorDate, "2026-10-04");
  assert.equal(user.decksData[0].activeCardId, cardTemplateId);
  assert.equal(user.cardsData[0].targetDate, "2026-10-11");
});
test("duplicate Step reservations abort an initial graph without partial roots or membership", async () => {
  const { repo, id, cards, content } = await setup(); cards[1].content.steps[0].stepId = cards[0].content.steps[0].stepId;
  await assert.rejects(repo.createPrivateGraph("alice", id, content, cards));
  assert.equal(await repo.cards().countDocuments(), 0); assert.equal(await repo.decks().countDocuments(), 0);
  assert.equal((await repo.getPersonalUser("alice"))!.decksData.length, 0);
});
test("concurrent working opens set one anchor and reuse global state; surrounding dates remain positional", async () => {
  const { repo, id, cards } = await published();
  await repo.ensureCardData("alice", cards[0].cardTemplateId, 1, "2030-01-01");
  await Promise.all([repo.openWorkingDeck("alice", id, "2026-10-04"), repo.openWorkingDeck("alice", id, "2026-10-04")]);
  await repo.openWorkingDeck("alice", id, "2026-12-25");
  const user = (await repo.getPersonalUser("alice"))!;
  assert.equal(user.cardsData.length, 2); assert.equal(user.decksData[0].cadenceAnchorDate, "2026-10-04");
  assert.equal(user.cardsData[0].targetDate, "2030-01-01"); assert.equal(user.cardsData[1].targetDate, "2026-10-18");
  const dto = await workingDTO(repo, "alice", id);
  assert.equal(dto.cards[0].label, "Card 1"); assert.equal(dto.cards[0].signals[0].id, cards[0].content.steps[0].stepId);
  assert.equal(dto.cards[0].signals[0].reading, null);
});
test("failed open rolls back initialization and anchor", async () => {
  const { repo, id, cards } = await published(); await repo.cardVersions().deleteOne({ cardTemplateId: cards[1].cardTemplateId });
  await assert.rejects(repo.openWorkingDeck("alice", id, "2026-10-04"), { code: "MISSING_CARD_VERSION" });
  const user = (await repo.getPersonalUser("alice"))!; assert.equal(user.cardsData.length, 0); assert.equal(user.decksData[0].cadenceAnchorDate, null);
});
test("working mutations use adopted Steps; archive/restore and publication leave sharing and personal media intact", async () => {
  const { repo, id, cards } = await published(); await repo.openWorkingDeck("alice", id, "2026-10-04");
  const cardId = cards[0].cardTemplateId, stepId = cards[0].content.steps[0].stepId;
  const legacy = { id: "legacy", mediaType: "image", src: "/trusted.png", description: "Legacy" };
  await repo.users().updateOne({ _id: "alice" }, { $set: { "cardsData.0.mediaItems": [legacy], "decksData.0.sharedWithUserIds": [{ untouched: true }] } });
  await repo.setCompletion("alice", id, cardId, stepId, "done"); await repo.setSignalReading("alice", id, cardId, stepId, 1);
  await repo.setReflection("alice", id, cardId, "Keep"); await repo.setTargetDate("alice", id, cardId, "2027-01-01");
  await repo.archiveDeckData("alice", id);
  assert.equal((await membershipDTO(repo, "alice"))[0].archivedAt !== null, true);
  await assert.rejects(repo.setCompletion("alice", id, cardId, stepId, "todo"), { code: "WORKING_DECK_REQUIRED" });
  await repo.saveCardDraft("alice", cardId, 1, { ...cards[0].content, steps: [...cards[0].content.steps].reverse() });
  await repo.publishCard("alice", cardId, 2);
  const archived = (await repo.getPersonalUser("alice"))!; assert.equal(archived.cardsData[0].cardTemplateVersion, 2); assert.notEqual(archived.decksData[0].archivedAt, null);
  await repo.reactivateDeckData("alice", id); await repo.openWorkingDeck("alice", id, "2028-01-01");
  const dto = await workingDTO(repo, "alice", id); assert.equal(dto.cards[0].steps[2].completionStatus, "done"); assert.equal(dto.cards[0].signals[2].reading, 1);
  assert.equal(dto.cards[0].targetDate, "2027-01-01"); assert.deepEqual(dto.cards[0].mediaItems, [legacy]);
  const raw = await repo.db.collection("users").findOne({ _id: "alice" as never });
  assert.deepEqual(raw!.sharedDeckData, [{ parked: "unchanged" }]); assert.deepEqual(raw!.decksData[0].sharedWithUserIds, [{ untouched: true }]);
});
test("existing adoptions are resolved exactly, never replaced by latest or historical publish pins", async () => {
  const { repo, id, cards, content } = await published(); await repo.openWorkingDeck("alice", id, "2026-10-04");
  await repo.saveCardDraft("alice", cards[0].cardTemplateId, 1, { ...cards[0].content, intro: { ...cards[0].content.intro, title: "Version 2" } });
  await repo.publishCard("alice", cards[0].cardTemplateId, 2);
  await repo.saveDeckDraft("alice", id, 1, { ...content, title: "Deck 2" }); await repo.publishDeck("alice", id, 2);
  await repo.users().updateOne({ _id: "alice" }, { $set: { "decksData.0.deckTemplateVersion": 1, "cardsData.0.cardTemplateVersion": 1 } });
  await repo.openWorkingDeck("alice", id, "2027-01-01"); const dto = await workingDTO(repo, "alice", id);
  assert.equal(dto.adoptedVersion, 1); assert.equal(dto.cards[0].adoptedVersion, 1); assert.equal(dto.title, "Private"); assert.equal(dto.cards[0].intro.title, "Practice");
  await repo.users().updateOne({ _id: "alice" }, { $set: { "cardsData.0.cardTemplateVersion": null } });
  await assert.rejects(repo.openWorkingDeck("alice", id, "2027-01-01"), { code: "UNPUBLISHED_CARD_ADOPTION" });
});
test("upload authorization uses adopted membership and canonical ownership, not auth snapshots", async () => {
  const { repo, id, cards } = await published(); await repo.openWorkingDeck("alice", id, "2026-10-04");
  const body = { scope: "user-card", deckTemplateId: id, cardTemplateId: cards[0].cardTemplateId };
  assert.equal((await authorizeUpload(repo, "alice", body, [])).cardTemplateId, cards[0].cardTemplateId);
  await assert.rejects(authorizeUpload(repo, "bob", body, []));
  await assert.rejects(authorizeUpload(repo, "alice", { ...body, cardTemplateId: randomUUID() }, []));
  await repo.archiveDeckData("alice", id); await assert.rejects(authorizeUpload(repo, "alice", body, []));
  assert.equal((await authorizeUpload(repo, "alice", { ...body, scope: "card-template" }, [])).scope, "card-template");
});
test("media append is strict and retryable while removal preserves other trusted metadata", async () => {
  const { repo, id, cards } = await published(); await repo.openWorkingDeck("alice", id, "2026-10-04"); const cardId = cards[0].cardTemplateId;
  const uuid = randomUUID(), assetId = `user-cards/alice/${cardId}/${uuid}.png`;
  const image = { id: `image-${uuid}`, mediaType: "image" as const, provider: "cloudflare-r2" as const, assetId, src: `https://assets.example/${assetId}`, description: "Image" };
  const validate = (value: unknown) => validateNewPersonalImage(value, "alice", cardId, (key) => `https://assets.example/${key}`);
  await repo.mutateMedia("alice", id, cardId, { append: image }, validate); await repo.mutateMedia("alice", id, cardId, { append: image }, validate);
  assert.equal((await workingDTO(repo, "alice", id)).cards[0].mediaItems.length, 1);
  await assert.rejects(repo.mutateMedia("alice", id, cardId, { append: { ...image, assetId: "user-decks/legacy.png" } }, validate));
  await repo.mutateMedia("alice", id, cardId, { remove: image.id }, validate); assert.equal((await workingDTO(repo, "alice", id)).cards[0].mediaItems.length, 0);
});

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { randomUUID } from "node:crypto";
import { MongoClient } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { CardRepository, createFoundationIndexes } from "../src/lib/cards/repository";
import { createDefaultCardContent, createDefaultDeckContent } from "../src/lib/cards/creatorDefaults";
import { resolveCreatorCard, resolveCreatorDeck } from "../src/lib/cards/resolvers";
import { creatorCardDTO, creatorDTO } from "../src/lib/cards/readModels";
import { creatorBoard, privateGraph } from "../src/components/creator/cardArchitectureAdapter";
import type { CreateAndAttachCardCommand } from "../src/lib/cards/model";

let server: MongoMemoryReplSet, client: MongoClient, sequence = 0;
before(async () => {
  // No environment/Atlas fallback. All writes are to this disposable replica set.
  server = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  client = await new MongoClient(server.getUri()).connect();
});
after(async () => { await client?.close(); await server?.stop(); });
const stepIds = () => Array.from({ length: 3 }, () => randomUUID());
async function setup() {
  const db = client.db(`switchplay_phase2_lifecycle_${sequence++}`);
  await createFoundationIndexes(db);
  const repo = new CardRepository(db, client);
  await repo.users().insertMany(["alice", "bob"].map((_id) => ({ _id, decksData: [], cardsData: [] })));
  return repo;
}
async function emptyDeck(repo: CardRepository) {
  const id = randomUUID(), content = createDefaultDeckContent(stepIds());
  await repo.createPrivateGraph("alice", id, content, []);
  return { id, content };
}
function addCommand(id: string, content: CreateAndAttachCardCommand["nextDeckContent"], revision = 0): CreateAndAttachCardCommand {
  const cardTemplateId = randomUUID();
  return { deckTemplateId: id, expectedDeckRevision: revision, cardTemplateId, stepIds: stepIds(),
    nextDeckContent: { ...content, cards: [...content.cards, { cardTemplateId }] } };
}

test("zero-Card initial graph is idempotent, creates only Deck membership, and leaves it unchanged on Add", async () => {
  const repo = await setup(), { id, content } = await emptyDeck(repo);
  await repo.createPrivateGraph("alice", id, content, []);
  assert.equal(await repo.cards().countDocuments(), 0); assert.equal(await repo.deckVersions().countDocuments(), 0);
  const personal = (await repo.getPersonalUser("alice"))!;
  assert.equal(personal.decksData.length, 1); assert.equal(personal.decksData[0].deckTemplateVersion, null);
  assert.deepEqual(personal.cardsData, []);
  await repo.createAndAttachCard("alice", addCommand(id, content));
  assert.deepEqual(await repo.getPersonalUser("alice"), personal);
});

test("first intentional Add can create Deck, default Card, reference and reservations in one graph transaction", async () => {
  const repo = await setup(), id = randomUUID(), command = addCommand(id, createDefaultDeckContent(stepIds()));
  const card = { cardTemplateId: command.cardTemplateId, content: createDefaultCardContent(command.stepIds) };
  await repo.createPrivateGraph("alice", id, command.nextDeckContent, [card]);
  await repo.createPrivateGraph("alice", id, command.nextDeckContent, [card]);
  assert.equal(await repo.cards().countDocuments(), 1); assert.equal(await repo.decks().countDocuments(), 1);
  assert.deepEqual((await repo.cards().findOne({ cardTemplateId: card.cardTemplateId }))!.stepIds, command.stepIds);
  assert.deepEqual((await resolveCreatorDeck(repo, "alice", id)).content.cards, [{ cardTemplateId: card.cardTemplateId }]);
});

test("existing-Deck Add atomically creates default Card and reservations, updates Deck revision, and recognizes exact retries", async () => {
  const repo = await setup(), { id, content } = await emptyDeck(repo), command = addCommand(id, content);
  const first = await repo.createAndAttachCard("alice", command);
  const repeated = await repo.createAndAttachCard("alice", command);
  assert.deepEqual(first, repeated);
  assert.equal(first.deck.root.revision, 1); assert.equal(first.card.root.revision, 0);
  assert.equal(first.card.content.intro.title, "My Next Card"); assert.deepEqual(first.card.root.stepIds, command.stepIds);
  assert.deepEqual(first.deck.content, command.nextDeckContent);
  assert.equal(await repo.cards().countDocuments(), 1); assert.equal(await repo.cardVersions().countDocuments(), 0);
});

test("concurrent same-ID Add commands commit once and return the same acknowledgement", async () => {
  const repo = await setup(), { id, content } = await emptyDeck(repo), command = addCommand(id, content);
  const results = await Promise.all([repo.createAndAttachCard("alice", command), repo.createAndAttachCard("alice", command)]);
  assert.deepEqual(results[0], results[1]);
  assert.equal(await repo.cards().countDocuments(), 1); assert.equal(results[0].deck.root.revision, 1);
});

test("global Step reservation failure rolls back the Add without Card root or Deck attachment", async () => {
  const repo = await setup(), { id, content } = await emptyDeck(repo);
  const reserved = await repo.createCardDraft("alice", createDefaultCardContent(stepIds()));
  const command = addCommand(id, content); command.stepIds[0] = reserved.stepIds[0];
  const before = await repo.decks().findOne({ deckTemplateId: id });
  await assert.rejects(repo.createAndAttachCard("alice", command), { code: "STEP_RESERVATION_CONFLICT" });
  assert.equal(await repo.cards().findOne({ cardTemplateId: command.cardTemplateId }), null);
  assert.deepEqual(await repo.decks().findOne({ deckTemplateId: id }), before);
});

test("stale revision, nonownership, duplicate Steps and missing references cannot partially create a Card", async () => {
  const repo = await setup(), { id, content } = await emptyDeck(repo), command = addCommand(id, content);
  await assert.rejects(repo.createAndAttachCard("alice", { ...command, expectedDeckRevision: 1 }), { code: "STALE_REVISION" });
  await assert.rejects(repo.createAndAttachCard("bob", command), { code: "DECK_FORBIDDEN" });
  await assert.rejects(repo.createAndAttachCard("alice", { ...command, stepIds: [command.stepIds[0], command.stepIds[0], command.stepIds[2]] }), { code: "DUPLICATE_STEP_ID" });
  await assert.rejects(repo.createAndAttachCard("alice", { ...command, nextDeckContent: { ...command.nextDeckContent,
    cards: [...command.nextDeckContent.cards, { cardTemplateId: "missing" }] } }), { code: "MISSING_CARD_REFERENCE" });
  assert.equal(await repo.cards().countDocuments(), 0); assert.equal((await repo.decks().findOne({ deckTemplateId: id }))!.revision, 0);
});

test("a Deck write failure after Card insertion rolls back roots and reservations together", async () => {
  const repo = await setup(), { id, content } = await emptyDeck(repo), command = addCommand(id, content);
  await repo.db.command({ collMod: "deckTemplates", validator: { revision: 0 }, validationLevel: "strict" });
  await assert.rejects(repo.createAndAttachCard("alice", command));
  assert.equal(await repo.cards().findOne({ cardTemplateId: command.cardTemplateId }), null);
  assert.equal((await repo.decks().findOne({ deckTemplateId: id }))!.revision, 0);
  await repo.db.command({ collMod: "deckTemplates", validator: {} });
  await repo.createAndAttachCard("alice", command); // Failed transaction did not reserve IDs.
});

test("uncertain-response recovery refuses subsequent edits/removal instead of creating replacements or reattaching", async () => {
  const repo = await setup(), { id, content } = await emptyDeck(repo), command = addCommand(id, content);
  await repo.createAndAttachCard("alice", command);
  await repo.saveDeckDraft("alice", id, 1, content);
  await assert.rejects(repo.createAndAttachCard("alice", command), { code: "ADD_CARD_RECOVERY_CONFLICT" });
  assert.equal(await repo.cards().countDocuments(), 1); assert.deepEqual((await resolveCreatorDeck(repo, "alice", id)).content.cards, []);
});

test("canonical owner can read, save and publish a detached private Card; other actors cannot", async () => {
  const repo = await setup(), { id, content } = await emptyDeck(repo), command = addCommand(id, content);
  await repo.createAndAttachCard("alice", command); await repo.saveDeckDraft("alice", id, 1, content);
  const saved = createDefaultCardContent(command.stepIds); saved.intro.title = "Sparse independent Card";
  await assert.rejects(resolveCreatorCard(repo, "bob", command.cardTemplateId), { code: "CARD_FORBIDDEN" });
  await assert.rejects(repo.saveCardDraft("bob", command.cardTemplateId, 0, saved), { code: "CARD_FORBIDDEN" });
  await assert.rejects(repo.publishCard("bob", command.cardTemplateId, 0), { code: "CARD_FORBIDDEN" });
  await assert.rejects(repo.saveCardDraft("alice", command.cardTemplateId, 1, saved), { code: "STALE_REVISION" });
  await repo.saveCardDraft("alice", command.cardTemplateId, 0, saved);
  assert.equal((await creatorCardDTO(repo, "alice", command.cardTemplateId)).content.intro.title, saved.intro.title);
  await assert.rejects(repo.publishCard("alice", command.cardTemplateId, 0), { code: "STALE_REVISION" });
  await repo.publishCard("alice", command.cardTemplateId, 1);
  assert.equal((await resolveCreatorCard(repo, "alice", command.cardTemplateId)).root.latestVersion, 1);
  assert.equal(await repo.deckVersions().countDocuments(), 0); assert.deepEqual((await repo.getPersonalUser("alice"))!.cardsData, []);
});

test("canonical first-publication title rules are enforced by repositories and duplicate sparse Card titles are valid", async () => {
  const repo = await setup(), { id, content } = await emptyDeck(repo);
  await assert.rejects(repo.publishDeck("alice", id, 0), { code: "DECK_FIRST_PUBLICATION_TITLE_REQUIRED" });
  const command = addCommand(id, content); await repo.createAndAttachCard("alice", command);
  await assert.rejects(repo.publishCard("alice", command.cardTemplateId, 0), { code: "CARD_FIRST_PUBLICATION_TITLE_REQUIRED" });
  const custom = createDefaultCardContent(command.stepIds); custom.intro.title = " Same title ";
  await repo.saveCardDraft("alice", command.cardTemplateId, 0, custom); await repo.publishCard("alice", command.cardTemplateId, 1);
  const otherContent = createDefaultCardContent(stepIds()); otherContent.intro.title = " Same title ";
  const other = await repo.createCardDraft("alice", otherContent); await repo.publishCard("alice", other.cardTemplateId, 0);
  const nextDeck = { ...command.nextDeckContent, title: " My Next  Path ", cards: [...command.nextDeckContent.cards, { cardTemplateId: other.cardTemplateId }] };
  await repo.saveDeckDraft("alice", id, 1, nextDeck); await repo.publishDeck("alice", id, 2);
  assert.equal((await repo.getDeckVersion(id, 1))!.content.title, " My Next  Path ");
  assert.deepEqual((await repo.getDeckVersion(id, 1))!.content.cards.map((ref) => ref.cardTemplateId), nextDeck.cards.map((ref) => ref.cardTemplateId));
});

test("blank/default titles cannot first-publish; zero-Card Deck with custom title can", async () => {
  const repo = await setup();
  for (const title of ["", "  ", " My Next Path "]) {
    const deck = await repo.createDeckDraft("alice", { ...createDefaultDeckContent([]), title });
    await assert.rejects(repo.publishDeck("alice", deck.deckTemplateId, 0), { code: "DECK_FIRST_PUBLICATION_TITLE_REQUIRED" });
  }
  for (const title of [null, "", "  ", " My Next Card "]) {
    const content = createDefaultCardContent(stepIds()); content.intro.title = title;
    const card = await repo.createCardDraft("alice", content);
    await assert.rejects(repo.publishCard("alice", card.cardTemplateId, 0), { code: "CARD_FIRST_PUBLICATION_TITLE_REQUIRED" });
  }
  const deck = await repo.createDeckDraft("alice", { ...createDefaultDeckContent([]), title: "Empty Deck" });
  await repo.publishDeck("alice", deck.deckTemplateId, 0);
  assert.deepEqual((await repo.getDeckVersion(deck.deckTemplateId, 1))!.content.cards, []);
});

test("title clearing uses latest published baseline across sessions, preserves versions, and later publication ignores default-title rules", async () => {
  const repo = await setup();
  const original = createDefaultCardContent(stepIds()); original.intro.title = "Version one";
  const card = await repo.createCardDraft("alice", original); await repo.publishCard("alice", card.cardTemplateId, 0);
  const versionOne = await repo.getCardVersion(card.cardTemplateId, 1);
  await repo.saveCardDraft("alice", card.cardTemplateId, 1, { ...original, intro: { ...original.intro, title: "Version two" } });
  await repo.publishCard("alice", card.cardTemplateId, 2);
  const deck = await repo.createDeckDraft("alice", { ...createDefaultDeckContent(stepIds()), title: "Deck one", cards: [{ cardTemplateId: card.cardTemplateId }] });
  await repo.publishDeck("alice", deck.deckTemplateId, 0);
  await repo.saveDeckDraft("alice", deck.deckTemplateId, 1, { ...deck.draft!, title: "Deck two" }); await repo.publishDeck("alice", deck.deckTemplateId, 2);
  await repo.saveCardDraft("alice", card.cardTemplateId, 3, { ...original, intro: { ...original.intro, title: "Unpublished" } });
  await repo.saveDeckDraft("alice", deck.deckTemplateId, 3, { ...deck.draft!, title: "Unpublished" });
  const reopened = await creatorDTO(repo, "alice", deck.deckTemplateId);
  assert.equal(reopened.publishedContent!.title, "Deck two"); assert.equal(reopened.cards[0].publishedContent!.intro.title, "Version two");
  assert.equal(creatorBoard(reopened).columns.find((column) => column.cardId === card.cardTemplateId)!.defaultCardTitle, "Version two");
  await repo.saveCardDraft("alice", card.cardTemplateId, 4, { ...original, intro: { ...original.intro, title: "  " } });
  await repo.saveDeckDraft("alice", deck.deckTemplateId, 4, { ...deck.draft!, title: "" });
  assert.equal((await resolveCreatorCard(repo, "alice", card.cardTemplateId)).content.intro.title, "Version two");
  assert.equal((await resolveCreatorDeck(repo, "alice", deck.deckTemplateId)).content.title, "Deck two");
  assert.deepEqual(await repo.getCardVersion(card.cardTemplateId, 1), versionOne);
  await repo.saveCardDraft("alice", card.cardTemplateId, 5, { ...original, intro: { ...original.intro, title: "My Next Card" } });
  await repo.publishCard("alice", card.cardTemplateId, 6);
  await repo.saveDeckDraft("alice", deck.deckTemplateId, 5, { ...deck.draft!, title: "My Next Path" }); await repo.publishDeck("alice", deck.deckTemplateId, 6);
});

test("never-published clearing restores defaults; old blank stored content is not normalized by reads or unrelated edits", async () => {
  const repo = await setup();
  const content = createDefaultCardContent(stepIds()); content.intro.title = "Named";
  const card = await repo.createCardDraft("alice", content);
  await repo.saveCardDraft("alice", card.cardTemplateId, 0, { ...content, intro: { ...content.intro, title: "" } });
  assert.equal((await resolveCreatorCard(repo, "alice", card.cardTemplateId)).content.intro.title, "My Next Card");
  const deck = await repo.createDeckDraft("alice", { ...createDefaultDeckContent([]), title: "Named" });
  await repo.saveDeckDraft("alice", deck.deckTemplateId, 0, { ...deck.draft!, title: " " });
  assert.equal((await resolveCreatorDeck(repo, "alice", deck.deckTemplateId)).content.title, "My Next Path");
  const legacy = createDefaultCardContent(stepIds()); legacy.intro.title = null;
  const oldCard = await repo.createCardDraft("alice", legacy);
  assert.equal((await creatorCardDTO(repo, "alice", oldCard.cardTemplateId)).content.intro.title, null);
  await repo.saveCardDraft("alice", oldCard.cardTemplateId, 0, { ...legacy, suggestedTargetDate: "2026-10-10" });
  assert.equal((await resolveCreatorCard(repo, "alice", oldCard.cardTemplateId)).content.intro.title, null);
});

test("construction Step movement retains Deck membership restrictions after canonical Card decoupling", async () => {
  const repo = await setup(), { id, content } = await emptyDeck(repo), command = addCommand(id, content);
  const { card } = await repo.createAndAttachCard("alice", command);
  const detached = await repo.createCardDraft("alice", createDefaultCardContent(stepIds()));
  await assert.rejects(repo.moveConstructionStep("alice", id, card.root.cardTemplateId, detached.cardTemplateId, 0, 0,
    { deck: 1, source: 0, destination: 0 }), { code: "CARD_OUTSIDE_DECK" });
});

test("newer Card draft does not block exact-composition Deck publication or get published with it", async () => {
  const repo = await setup(), { id, content } = await emptyDeck(repo), command = addCommand(id, content);
  await repo.createAndAttachCard("alice", command);
  const card = createDefaultCardContent(command.stepIds); card.intro.title = "Published";
  await repo.saveCardDraft("alice", command.cardTemplateId, 0, card); await repo.publishCard("alice", command.cardTemplateId, 1);
  await repo.saveCardDraft("alice", command.cardTemplateId, 2, { ...card, intro: { ...card.intro, title: "New draft" } });
  await repo.saveDeckDraft("alice", id, 1, { ...command.nextDeckContent, title: "Published Deck" }); await repo.publishDeck("alice", id, 2);
  assert.equal((await repo.getDeckVersion(id, 1))!.content.cards[0].cardVersionAtPublish, 1);
  assert.equal((await resolveCreatorCard(repo, "alice", command.cardTemplateId)).root.latestVersion, 1);
  assert.equal((await resolveCreatorCard(repo, "alice", command.cardTemplateId)).content.intro.title, "New draft");
});

test("stored My New Card draft remains unchanged by Creator resolution and projection", async () => {
  const repo = await setup();
  const content = createDefaultCardContent(stepIds()); content.intro.title = "My New Card";
  const card = await repo.createCardDraft("alice", content);
  const deck = await repo.createDeckDraft("alice", { ...createDefaultDeckContent([]), title: "Stored", themes: [{ id: "old", title: "Stream 1" }], cards: [{ cardTemplateId: card.cardTemplateId }] });
  const beforeDeck = await repo.decks().findOne({ deckTemplateId: deck.deckTemplateId }), beforeCard = await repo.cards().findOne({ cardTemplateId: card.cardTemplateId });
  const dto = await creatorDTO(repo, "alice", deck.deckTemplateId), graph = privateGraph(creatorBoard(dto), dto);
  assert.equal(graph.cards[0].content.intro.title, "My New Card"); assert.equal(graph.content.themes[0].title, "Stream 1");
  assert.deepEqual(await repo.decks().findOne({ deckTemplateId: deck.deckTemplateId }), beforeDeck);
  assert.deepEqual(await repo.cards().findOne({ cardTemplateId: card.cardTemplateId }), beforeCard);
});

test("legacy unusable published titles fall back to creation defaults only on a clearing edit", async () => {
  const repo = await setup(), id = randomUUID(), cardTemplateId = randomUUID();
  const card = createDefaultCardContent(stepIds()); card.intro.title = null;
  const content = { ...createDefaultDeckContent([]), title: " ", cards: [{ cardTemplateId }] };
  await repo.createPrivateGraph("alice", id, content, [{ cardTemplateId, content: card }]);
  const now = new Date();
  // Seed legacy published baselines directly; no existing immutable version is edited.
  await repo.cardVersions().insertOne({ cardTemplateId, version: 1, content: card, publishedAt: now, publishedByUserId: "alice" });
  await repo.deckVersions().insertOne({ deckTemplateId: id, version: 1, content: { ...content, cards: [{ cardTemplateId, cardVersionAtPublish: 1 }] }, publishedAt: now, publishedByUserId: "alice" });
  await repo.cards().updateOne({ cardTemplateId }, { $set: { latestVersion: 1, draft: null } });
  await repo.decks().updateOne({ deckTemplateId: id }, { $set: { latestVersion: 1, draft: null } });
  assert.equal((await resolveCreatorCard(repo, "alice", cardTemplateId)).content.intro.title, null);
  assert.equal((await resolveCreatorDeck(repo, "alice", id)).content.title, " ");
  await repo.saveCardDraft("alice", cardTemplateId, 0, { ...card, intro: { ...card.intro, title: "Editing" } });
  await repo.saveCardDraft("alice", cardTemplateId, 1, { ...card, intro: { ...card.intro, title: "" } });
  await repo.saveDeckDraft("alice", id, 0, { ...content, title: "Editing" });
  await repo.saveDeckDraft("alice", id, 1, { ...content, title: "" });
  assert.equal((await resolveCreatorCard(repo, "alice", cardTemplateId)).content.intro.title, "My Next Card");
  assert.equal((await resolveCreatorDeck(repo, "alice", id)).content.title, "My Next Path");
  assert.equal((await repo.getCardVersion(cardTemplateId, 1))!.content.intro.title, null);
  assert.equal((await repo.getDeckVersion(id, 1))!.content.title, " ");
});

test("later equal Deck saves clear drafts, while the existing visibility-only public publication contract is preserved", async () => {
  const repo = await setup();
  const content = createDefaultCardContent(stepIds()); content.intro.title = "Practice";
  const card = await repo.createCardDraft("alice", content); await repo.publishCard("alice", card.cardTemplateId, 0);
  const deck = await repo.createDeckDraft("alice", { ...createDefaultDeckContent([]), title: "Practice Deck", cards: [{ cardTemplateId: card.cardTemplateId }] });
  await repo.publishDeck("alice", deck.deckTemplateId, 0);
  await repo.saveDeckDraft("alice", deck.deckTemplateId, 1, deck.draft!);
  await assert.rejects(repo.publishDeck("alice", deck.deckTemplateId, 2), { code: "NO_UNPUBLISHED_CHANGES" });
  await repo.saveDeckDraft("alice", deck.deckTemplateId, 2, deck.draft!, "public");
  const review = await repo.prepareDeckPublication("alice", deck.deckTemplateId, 3);
  await repo.publishDeck("alice", deck.deckTemplateId, 3, undefined, { review, acceptCardDrafts: false });
  assert.equal((await repo.cards().findOne({ cardTemplateId: card.cardTemplateId }))!.visibility, "public");
  assert.equal(await repo.cardVersions().countDocuments(), 1);
});

test("Deck preparation reviews exact ordered references and publishes older Card versions without publishing their drafts", async () => {
  const repo = await setup(), { id, content } = await emptyDeck(repo), command = addCommand(id, content);
  await repo.createAndAttachCard("alice", command);
  let card = (await resolveCreatorCard(repo, "alice", command.cardTemplateId));
  const published = { ...card.content, intro: { ...card.content.intro, title: "Published Card" } };
  await repo.saveCardDraft("alice", command.cardTemplateId, 0, published); await repo.publishCard("alice", command.cardTemplateId, 1);
  card = await resolveCreatorCard(repo, "alice", command.cardTemplateId);
  await repo.saveCardDraft("alice", command.cardTemplateId, card.root.revision, { ...published, intro: { ...published.intro, title: "Unpublished newer Card" } });
  await repo.saveDeckDraft("alice", id, 1, { ...command.nextDeckContent, title: "Published path" });
  const review = await repo.prepareDeckPublication("alice", id, 2);
  assert.deepEqual(review.cards, [{ cardTemplateId: command.cardTemplateId, revision: 3, latestVersion: 1, hasDraft: true }]);
  await assert.rejects(repo.publishDeck("alice", id, 2, undefined, { review, acceptCardDrafts: false }), { code: "CARD_DRAFT_CONFIRMATION_REQUIRED" });
  await repo.publishDeck("alice", id, 2, undefined, { review, acceptCardDrafts: true });
  assert.deepEqual((await repo.getDeckVersion(id, 1))!.content.cards, [{ cardTemplateId: command.cardTemplateId, cardVersionAtPublish: 1 }]);
  assert.equal((await resolveCreatorCard(repo, "alice", command.cardTemplateId)).content.intro.title, "Unpublished newer Card");
  assert.equal(await repo.cardVersions().countDocuments(), 1);
});

test("authoritative Deck publication recheck rejects changed Card draft or published version and creates no immutable Deck version", async () => {
  const repo = await setup(), { id, content } = await emptyDeck(repo), command = addCommand(id, content);
  await repo.createAndAttachCard("alice", command);
  const published = createDefaultCardContent(command.stepIds); published.intro.title = "Card";
  await repo.saveCardDraft("alice", command.cardTemplateId, 0, published); await repo.publishCard("alice", command.cardTemplateId, 1);
  await repo.saveDeckDraft("alice", id, 1, { ...command.nextDeckContent, title: "Path" });
  const review = await repo.prepareDeckPublication("alice", id, 2);
  await repo.saveCardDraft("alice", command.cardTemplateId, 2, { ...published, suggestedTargetDate: "2026-10-09" });
  await assert.rejects(repo.publishDeck("alice", id, 2, undefined, { review, acceptCardDrafts: true }), { code: "DECK_PUBLICATION_REVIEW_CONFLICT" });
  const newer = await repo.prepareDeckPublication("alice", id, 2);
  await repo.publishCard("alice", command.cardTemplateId, 3);
  await assert.rejects(repo.publishDeck("alice", id, 2, undefined, { review: newer, acceptCardDrafts: true }), { code: "DECK_PUBLICATION_REVIEW_CONFLICT" });
  assert.equal(await repo.deckVersions().countDocuments(), 0);
});

test("Deck review cannot be used after exact composition revision changes, even for zero Cards", async () => {
  const repo = await setup(), { id, content } = await emptyDeck(repo);
  await repo.saveDeckDraft("alice", id, 0, { ...content, title: "Zero Cards" });
  const review = await repo.prepareDeckPublication("alice", id, 1);
  await repo.saveDeckDraft("alice", id, 1, { ...content, title: "Different saved Deck" });
  await assert.rejects(repo.publishDeck("alice", id, 2, undefined, { review, acceptCardDrafts: false }), { code: "DECK_PUBLICATION_REVIEW_CONFLICT" });
  assert.equal(await repo.deckVersions().countDocuments(), 0);
});

// Exercise client orchestration against real transactions, including committed
// writes whose HTTP-equivalent response was lost. No mocks of Mongo operations.
async function coordinated(repo: CardRepository, id: string) {
  const { CreatorPersistenceCoordinator } = await import("../src/components/creator/creatorPersistenceCoordinator");
  const dto = await creatorDTO(repo, "alice", id);
  let loseAdd = false, losePublish = false;
  const request = async <T>(url: string, method = "GET", payload?: unknown): Promise<T> => {
    const body = payload as { revision: number; cardTemplateId: string; stepIds: string[]; content: CreateAndAttachCardCommand["nextDeckContent"]; type: string; review: Awaited<ReturnType<CardRepository["prepareDeckPublication"]>>; acceptCardDrafts: boolean };
    if (url.includes("/card-templates/")) {
      const cardId = url.split("?")[0].split("/").at(-1)!;
      if (url.includes("?version=")) return (await repo.getCardVersion(cardId, Number(new URL(url, "http://fixture").searchParams.get("version")))) as T;
      if (method === "PATCH") {
        if (body.type === "save") await repo.saveCardDraft("alice", cardId, body.revision, body.content as never);
        else { await repo.publishCard("alice", cardId, body.revision); if (losePublish) { losePublish = false; throw new Error("committed publication response lost"); } }
      }
      return await creatorCardDTO(repo, "alice", cardId) as T;
    }
    if (url.endsWith("/cards")) {
      const result = await repo.createAndAttachCard("alice", { deckTemplateId: id, expectedDeckRevision: body.revision, cardTemplateId: body.cardTemplateId, stepIds: body.stepIds, nextDeckContent: body.content });
      if (loseAdd) { loseAdd = false; throw new Error("committed Add response lost"); }
      return result as T;
    }
    if (url.includes("/publish?")) return await repo.prepareDeckPublication("alice", id, Number(new URL(url, "http://fixture").searchParams.get("revision"))) as T;
    if (url.endsWith("/saved")) await repo.saveDeckDraft("alice", id, body.revision, body.content);
    if (method === "POST" && url.endsWith("/publish")) await repo.publishDeck("alice", id, body.revision, undefined, { review: body.review, acceptCardDrafts: body.acceptCardDrafts });
    return await creatorDTO(repo, "alice", id) as T;
  };
  return { coordinator: new CreatorPersistenceCoordinator(creatorBoard(dto), dto, request), loseAdd() { loseAdd = true; }, losePublish() { losePublish = true; } };
}

test("coordinator recovers uncertain atomic Add, then saves immediate Card edit with returned revision and stable IDs", async () => {
  const repo = await setup(), { id } = await emptyDeck(repo), { coordinator: c, loseAdd } = await coordinated(repo, id);
  const cardId = randomUUID(), ids = stepIds(); loseAdd();
  c.addCard(cardId, ids, { ...c.deck.desired, cards: [{ cardTemplateId: cardId }] });
  c.editCard(cardId, { ...c.cards.get(cardId)!.desired, intro: { title: "Immediate edit", description: null, mediaItem: null } });
  await c.flushCard(cardId); await c.deck.flush();
  assert.equal(await repo.cards().countDocuments(), 1); assert.equal(c.cards.get(cardId)!.ack!.root.revision, 1);
  assert.deepEqual((await repo.cards().findOne({ cardTemplateId: cardId }))!.stepIds, ids);
  assert.equal((await resolveCreatorCard(repo, "alice", cardId)).content.intro.title, "Immediate edit");
});

test("coordinator reconciles committed Card publication and does not create duplicate immutable versions on retry", async () => {
  const repo = await setup(), { id, content } = await emptyDeck(repo), command = addCommand(id, content);
  await repo.createAndAttachCard("alice", command);
  const { coordinator: c, losePublish } = await coordinated(repo, id), lane = c.cards.get(command.cardTemplateId)!;
  c.editCard(command.cardTemplateId, { ...lane.desired, intro: { ...lane.desired.intro, title: "Sparse Card" } });
  losePublish(); await c.publishCard(command.cardTemplateId); await c.publishCard(command.cardTemplateId);
  assert.equal(await repo.cardVersions().countDocuments(), 1); assert.equal(await repo.deckVersions().countDocuments(), 0);
  assert.equal((await repo.getPersonalUser("alice"))!.cardsData.length, 0);
});

test("scoped Deck publication through coordinator leaves newer Card draft intact and pins exact composition", async () => {
  const repo = await setup(), { id, content } = await emptyDeck(repo), command = addCommand(id, content);
  await repo.createAndAttachCard("alice", command);
  const { coordinator: c } = await coordinated(repo, id), lane = c.cards.get(command.cardTemplateId)!;
  c.editCard(command.cardTemplateId, { ...lane.desired, intro: { ...lane.desired.intro, title: "Card" } }); await c.publishCard(command.cardTemplateId);
  c.editCard(command.cardTemplateId, { ...lane.desired, suggestedTargetDate: "2026-10-15" }); await c.flushCard(command.cardTemplateId);
  c.editDeck({ ...c.deck.desired, title: "Deck" });
  let warned: string[] = []; await c.publishDeck(undefined, async (ids) => { warned = ids; return true; });
  assert.deepEqual(warned, [command.cardTemplateId]);
  assert.deepEqual((await repo.getDeckVersion(id, 1))!.content.cards, [{ cardTemplateId: command.cardTemplateId, cardVersionAtPublish: 1 }]);
  assert.equal((await repo.cards().findOne({ cardTemplateId: command.cardTemplateId }))!.draft!.suggestedTargetDate, "2026-10-15");
});

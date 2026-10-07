import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { MongoClient } from "mongodb";
import { createStep, reorderSteps } from "../src/lib/cards/domain";
import { CardRepository, createFoundationIndexes } from "../src/lib/cards/repository";
import type { CardContent, DeckContent } from "../src/lib/cards/model";
import { resolveWorkingDeck, resolveDeckPreview, resolveHistoricalDeck, resolveCreatorDeck, authorizeWorkingCard } from "../src/lib/cards/resolvers";

let server: MongoMemoryReplSet;
let client: MongoClient;
let sequence = 0;
before(async () => {
  // Deliberately no env-based URI fallback. These tests cannot connect to Atlas.
  server = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  client = await new MongoClient(server.getUri()).connect();
});
after(async () => { await client?.close(); await server?.stop(); });
const cardContent = (): CardContent => ({ intro: { title: "Practice", description: "Content", mediaItem: null }, suggestedTargetDate: "", steps: [createStep("One"), createStep("Two"), createStep("Three")] });
const deckContent = (ids: string[]): DeckContent => ({ title: "Practice Deck", introduction: null, categories: [], themes: [], cadence: { intervalDays: 7 }, labelPrefix: "Card", cards: ids.map((cardTemplateId) => ({ cardTemplateId })) });
async function setup() {
  const db = client.db(`switchplay_migration_integration_${sequence++}`);
  await createFoundationIndexes(db);
  const repo = new CardRepository(db, client);
  await repo.users().insertMany(["alice", "bob"].map((_id) => ({ _id, decksData: [], cardsData: [] })));
  return repo;
}

test("drafts, immutable versions, revisions, publication independence and update notes", async () => {
  const repo = await setup();
  const content = cardContent(); const card = await repo.createCardDraft("alice", content);
  await assert.rejects(repo.publishCard("alice", { $ne: null } as unknown as string, 0), { code: "INVALID_ENTITY_ID" });
  await assert.rejects(repo.ensureCardData("alice", { $ne: null } as unknown as string, 1), { code: "INVALID_ENTITY_ID" });
  assert.equal(card.latestVersion, 0); assert.equal(await repo.getCardVersion(card.cardTemplateId, 1), null);
  assert.equal(await repo.saveCardDraft("alice", card.cardTemplateId, 0, content), 1);
  await assert.rejects(repo.saveCardDraft("alice", card.cardTemplateId, 0, content), { code: "STALE_REVISION" });
  await assert.rejects(repo.publishCard("alice", card.cardTemplateId, 0), { code: "STALE_REVISION" });
  const deck = await repo.createDeckDraft("alice", deckContent([card.cardTemplateId]));
  await assert.rejects(repo.publishDeck("alice", deck.deckTemplateId, 0), { code: "UNPUBLISHED_CARDS_BLOCK_DECK" });
  assert.equal(await repo.publishCard("alice", card.cardTemplateId, 1, "First"), 1);
  const first = await repo.getCardVersion(card.cardTemplateId, 1);
  assert.equal((await repo.cards().findOne({ cardTemplateId: card.cardTemplateId }))!.draft, null);
  assert.equal(await repo.publishDeck("alice", deck.deckTemplateId, 0, "Deck first"), 1);
  const firstDeck = await repo.getDeckVersion(deck.deckTemplateId, 1);
  await repo.saveCardDraft("alice", card.cardTemplateId, 2, { ...content, intro: { ...content.intro, title: "Changed" } });
  await repo.saveDeckDraft("alice", deck.deckTemplateId, 1, { ...deckContent([card.cardTemplateId]), title: "Changed Deck" });
  assert.equal(await repo.publishDeck("alice", deck.deckTemplateId, 2), 2);
  assert.equal((await repo.getDeckVersion(deck.deckTemplateId, 2))!.content.cards[0].cardVersionAtPublish, 1);
  assert.equal((await repo.cards().findOne({ cardTemplateId: card.cardTemplateId }))!.latestVersion, 1);
  assert.equal(await repo.publishCard("alice", card.cardTemplateId, 3, "Second"), 2);
  assert.deepEqual(await repo.getCardVersion(card.cardTemplateId, 1), first);
  assert.deepEqual(await repo.getDeckVersion(deck.deckTemplateId, 1), firstDeck);
  assert.equal((await repo.decks().findOne({ deckTemplateId: deck.deckTemplateId }))!.latestVersion, 2);
  assert.equal((await repo.getPersonalUser("alice"))!.cardsData.length, 1);
  assert.equal((await repo.getCardVersion(card.cardTemplateId, 2))!.updateNote, "Second");
});

test("publisher adoption preserves personal state and archive; followers never auto-adopt", async () => {
  const repo = await setup(); const content = cardContent();
  const card = await repo.createCardDraft("alice", content, "public");
  await repo.publishCard("alice", card.cardTemplateId, 0);
  const deck = await repo.createDeckDraft("alice", deckContent([card.cardTemplateId]), "public");
  await repo.publishDeck("alice", deck.deckTemplateId, 0);
  await repo.ensureDeckData("alice", deck.deckTemplateId, 1);
  await repo.ensureCardData("alice", card.cardTemplateId, 1);
  await repo.ensureCardData("bob", card.cardTemplateId, 1);
  await repo.ensureDeckData("bob", deck.deckTemplateId, 1);
  await repo.users().updateOne({ _id: "alice" }, { $set: { "cardsData.0.reflection": "Keep", "cardsData.0.items.0.completionStatus": "done", "cardsData.0.signalReadings.0.reading": 1,
    "cardsData.0.targetDate": "2026-12-12", "cardsData.0.mediaItems": [{ id: "trusted", mediaType: "image", src: "/legacy.png", description: "Keep" }],
    "cardsData.0.tests": [{ id: "test", date: "2026-01-01", result: false, createdAt: new Date() }], "cardsData.0.chats": [{ id: "chat", deckTemplateId: deck.deckTemplateId, comments: [] }] } });
  const before = (await repo.getPersonalUser("alice"))!.cardsData[0];
  await repo.archiveDeckData("alice", deck.deckTemplateId);
  const archivedAt = (await repo.getPersonalUser("alice"))!.decksData[0].archivedAt;
  await repo.saveCardDraft("alice", card.cardTemplateId, 1, { ...content, intro: { ...content.intro, title: "Updated" } });
  await repo.publishCard("alice", card.cardTemplateId, 2);
  await repo.saveDeckDraft("alice", deck.deckTemplateId, 1, { ...deckContent([card.cardTemplateId]), title: "Updated" });
  await repo.publishDeck("alice", deck.deckTemplateId, 2);
  const after = (await repo.getPersonalUser("alice"))!;
  assert.equal(after.cardsData[0].cardTemplateVersion, 2);
  assert.deepEqual({ ...after.cardsData[0], cardTemplateVersion: before.cardTemplateVersion, updatedAt: before.updatedAt }, before);
  assert.equal(after.decksData[0].deckTemplateVersion, 2); assert.deepEqual(after.decksData[0].archivedAt, archivedAt);
  assert.equal((await repo.activeMemberships("alice")).length, 0);
  assert.equal((await repo.getPersonalUser("bob"))!.cardsData[0].cardTemplateVersion, 1);
  assert.equal((await repo.getPersonalUser("bob"))!.decksData[0].deckTemplateVersion, 1);
});

test("drafts have no membership; first private publication admits the Deck and restore retains adoption", async () => {
  const repo = await setup(); const card = await repo.createCardDraft("alice", cardContent());
  const deck = await repo.createDeckDraft("alice", deckContent([card.cardTemplateId]));
  assert.equal((await repo.getPersonalUser("alice"))!.cardsData.length, 0);
  assert.equal((await repo.getPersonalUser("alice"))!.decksData.length, 0);
  assert.equal(await resolveWorkingDeck(repo, "alice", deck.deckTemplateId), null);
  await repo.publishCard("alice", card.cardTemplateId, 0); await repo.publishDeck("alice", deck.deckTemplateId, 0);
  assert.equal((await resolveWorkingDeck(repo, "alice", deck.deckTemplateId))!.mode, "working");
  await repo.archiveDeckData("alice", deck.deckTemplateId); assert.equal(await resolveWorkingDeck(repo, "alice", deck.deckTemplateId), null);
  await repo.reactivateDeckData("alice", deck.deckTemplateId);
  assert.equal((await repo.getPersonalUser("alice"))!.decksData[0].deckTemplateVersion, 1);
});

test("concurrent ensure operations remain unique and retain adopted version, dates and sharing", async () => {
  const repo = await setup(); const card = await repo.createCardDraft("alice", cardContent(), "public");
  await repo.publishCard("alice", card.cardTemplateId, 0);
  const deck = await repo.createDeckDraft("alice", deckContent([card.cardTemplateId]), "public"); await repo.publishDeck("alice", deck.deckTemplateId, 0);
  await Promise.all(Array.from({ length: 5 }, () => repo.ensureCardData("bob", card.cardTemplateId, 1, "2026-10-12")));
  await Promise.all(Array.from({ length: 5 }, () => repo.ensureDeckData("bob", deck.deckTemplateId, 1)));
  const user = (await repo.getPersonalUser("bob"))!;
  assert.equal(user.cardsData.length, 1); assert.equal(user.decksData.length, 1);
  await repo.ensureCardData("bob", card.cardTemplateId, 1, "2028-01-01");
  assert.equal((await repo.getPersonalUser("bob"))!.cardsData[0].targetDate, "2026-10-12");
  await assert.rejects(repo.ensureCardData("bob", card.cardTemplateId, 0), { code: "INVALID_ADOPTED_VERSION" });
  await assert.rejects(repo.ensureDeckData("bob", deck.deckTemplateId, null as never), { code: "INVALID_ADOPTED_VERSION" });
});

test("same-Card reorder and initial cross-Card swap preserve global Step identity", async () => {
  const repo = await setup(); const content = cardContent();
  const a = await repo.createCardDraft("alice", content); const b = await repo.createCardDraft("alice", cardContent());
  const deck = await repo.createDeckDraft("alice", deckContent([a.cardTemplateId, b.cardTemplateId]));
  assert.equal(reorderSteps(content, 0, 2).steps[2].stepId, content.steps[0].stepId);
  const moved = await repo.moveConstructionStep("alice", deck.deckTemplateId, a.cardTemplateId, b.cardTemplateId, 0, 1, { deck: 0, source: 0, destination: 0 });
  assert.equal(moved.destination.steps[1].stepId, content.steps[0].stepId);
  assert.equal(moved.source.steps[0].stepId, b.draft!.steps[1].stepId);
  assert.equal(moved.source.steps.length, 3); assert.equal(moved.destination.steps.length, 3);
  await assert.rejects(repo.createCardDraft("alice", content)); // Global uniqueness reservation.
  await repo.publishCard("alice", a.cardTemplateId, 1);
  await assert.rejects(repo.moveConstructionStep("alice", deck.deckTemplateId, a.cardTemplateId, b.cardTemplateId, 0, 0, { deck: 1, source: 2, destination: 1 }), { code: "CROSS_CARD_MOVE_AFTER_PUBLICATION" });
});

test("Step reservations retain removed draft and published identities through construction swaps", async () => {
  const repo = await setup();
  const a = await repo.createCardDraft("alice", cardContent());
  const b = await repo.createCardDraft("alice", cardContent());
  const deck = await repo.createDeckDraft("alice", deckContent([a.cardTemplateId, b.cardTemplateId]));
  const replaceFirst = (content: CardContent) => ({ ...content, steps: [createStep("Replacement"), ...content.steps.slice(1)] });
  const source = replaceFirst(a.draft!); const destination = replaceFirst(b.draft!);
  await repo.saveCardDraft("alice", a.cardTemplateId, 0, source);
  await repo.saveCardDraft("alice", b.cardTemplateId, 0, destination);
  await assert.rejects(repo.saveCardDraft("alice", a.cardTemplateId, 1, { ...source, steps: [source.steps[0], source.steps[0], source.steps[2]] }), { code: "DUPLICATE_STEP_ID" });
  await assert.rejects(repo.createCardDraft("alice", { ...source, steps: [source.steps[0], source.steps[0], source.steps[2]] }), { code: "DUPLICATE_STEP_ID" });
  const moved = await repo.moveConstructionStep("alice", deck.deckTemplateId, a.cardTemplateId, b.cardTemplateId, 0, 0, { deck: 0, source: 1, destination: 1 });
  const sourceRoot = (await repo.cards().findOne({ cardTemplateId: a.cardTemplateId }))!;
  const destinationRoot = (await repo.cards().findOne({ cardTemplateId: b.cardTemplateId }))!;
  assert.deepEqual(new Set(sourceRoot.stepIds), new Set([...a.stepIds, destination.steps[0].stepId]));
  assert.deepEqual(new Set(destinationRoot.stepIds), new Set([...b.stepIds, source.steps[0].stepId]));
  assert.equal(new Set(sourceRoot.stepIds).size, sourceRoot.stepIds.length);
  assert.equal(new Set(destinationRoot.stepIds).size, destinationRoot.stepIds.length);
  await assert.rejects(repo.createCardDraft("alice", a.draft!), { code: 11000 });
  await assert.rejects(repo.createCardDraft("alice", b.draft!), { code: 11000 });
  await repo.publishCard("alice", a.cardTemplateId, 2);
  const publishedStep = moved.source.steps[0].stepId;
  await repo.saveCardDraft("alice", a.cardTemplateId, 3, replaceFirst(moved.source));
  await repo.publishCard("alice", a.cardTemplateId, 4);
  const publishedRoot = (await repo.cards().findOne({ cardTemplateId: a.cardTemplateId }))!;
  assert.ok(publishedRoot.stepIds.includes(publishedStep));
  assert.ok(publishedRoot.stepIds.includes(a.draft!.steps[0].stepId));
  assert.equal((await repo.getCardVersion(a.cardTemplateId, 1))!.content.steps[0].stepId, publishedStep);
  assert.notEqual((await repo.getCardVersion(a.cardTemplateId, 2))!.content.steps[0].stepId, publishedStep);
  await assert.rejects(repo.createCardDraft("alice", moved.source), { code: 11000 });
});

test("working adoption, template preview and historical pins select independent versions", async () => {
  const repo = await setup(); const content = cardContent(); const card = await repo.createCardDraft("alice", content, "public");
  await repo.publishCard("alice", card.cardTemplateId, 0);
  const deck = await repo.createDeckDraft("alice", deckContent([card.cardTemplateId]), "public"); await repo.publishDeck("alice", deck.deckTemplateId, 0);
  await repo.ensureDeckData("bob", deck.deckTemplateId, 1); await repo.ensureCardData("bob", card.cardTemplateId, 1);
  await repo.saveCardDraft("alice", card.cardTemplateId, 1, { ...content, intro: { ...content.intro, title: "New" } }); await repo.publishCard("alice", card.cardTemplateId, 2);
  const working = await resolveWorkingDeck(repo, "bob", deck.deckTemplateId); assert.equal(working?.mode, "working");
  if (working?.mode === "working") assert.equal(working.cards[0].version.version, 1);
  assert.equal((await resolveDeckPreview(repo, deck.deckTemplateId)).cards[0].version.version, 2);
  assert.equal((await resolveHistoricalDeck(repo, deck.deckTemplateId, 1)).cards[0].version.version, 1);
  await authorizeWorkingCard(repo, "bob", deck.deckTemplateId, card.cardTemplateId);
  await repo.archiveDeckData("bob", deck.deckTemplateId);
  await assert.rejects(authorizeWorkingCard(repo, "bob", deck.deckTemplateId, card.cardTemplateId));
  await repo.saveCardDraft("alice", card.cardTemplateId, 3, { ...content, intro: { ...content.intro, title: "Secret draft" } });
  const bobDeck = await repo.createDeckDraft("bob", deckContent([card.cardTemplateId]));
  const creator = await resolveCreatorDeck(repo, "bob", bobDeck.deckTemplateId);
  assert.equal(creator.cards[0].root.draft, null); assert.equal(creator.cards[0].content.intro.title, "New");
  await repo.publishDeck("bob", bobDeck.deckTemplateId, 0);
  const reused = await resolveWorkingDeck(repo, "bob", bobDeck.deckTemplateId);
  assert.equal(reused?.mode, "working");
  if (reused?.mode === "working") {
    assert.equal(reused.cards[0].version.version, 1); // Existing adoption wins over this Deck's v2 historical Card pin.
    assert.equal(reused.cards[0].permissions.templateOwnerUserId, "alice");
    assert.equal(reused.cards[0].permissions.dataOwnerUserId, "bob");
    assert.equal(reused.cards[0].permissions.canEditDeck, true); assert.equal(reused.cards[0].permissions.canEditCard, false);
    assert.equal(reused.cards[0].permissions.canMutateCardData, true); assert.equal(reused.cards[0].permissions.canUpdateCard, true);
  }
  assert.equal((await repo.getPersonalUser("bob"))!.cardsData.length, 1);
  const editable = await resolveCreatorDeck(repo, "bob", bobDeck.deckTemplateId);
  assert.ok(!Object.hasOwn(editable.content.cards[0], "cardVersionAtPublish"));
  await repo.saveDeckDraft("bob", bobDeck.deckTemplateId, 1, editable.content);
  assert.equal((await repo.decks().findOne({ deckTemplateId: bobDeck.deckTemplateId }))!.draft, null);
  await repo.saveDeckDraft("alice", deck.deckTemplateId, 1, { ...deckContent([card.cardTemplateId]), title: "Secret Deck draft" });
  const preview = await resolveDeckPreview(repo, deck.deckTemplateId);
  assert.equal(preview.root.draft, null); assert.equal(preview.cards[0].root.draft, null);
  const workingWithDrafts = await resolveWorkingDeck(repo, "bob", deck.deckTemplateId);
  if (workingWithDrafts?.mode === "working") { assert.equal(workingWithDrafts.root.draft, null); assert.equal(workingWithDrafts.cards[0].root.draft, null); }
});

test("public Deck publication rejects private Cards without changing their drafts or revisions", async () => {
  const repo = await setup(); const card = await repo.createCardDraft("alice", cardContent()); await repo.publishCard("alice", card.cardTemplateId, 0);
  await repo.saveCardDraft("alice", card.cardTemplateId, 1, cardContent());
  const deck = await repo.createDeckDraft("alice", deckContent([card.cardTemplateId]), "public");
  await assert.rejects(repo.publishDeck("alice", deck.deckTemplateId, 0), { code: "PRIVATE_CARDS_BLOCK_PUBLIC_DECK" });
  const root = (await repo.cards().findOne({ cardTemplateId: card.cardTemplateId }))!;
  assert.equal(root.visibility, "private"); assert.equal(root.revision, 2); assert.equal(root.latestVersion, 1); assert.notEqual(root.draft, null);
  assert.equal(await repo.getDeckVersion(deck.deckTemplateId, 1), null);
  await assert.rejects(repo.saveCardDraft("bob", card.cardTemplateId, root.revision, cardContent()), { code: "CARD_FORBIDDEN" });
  const foreignPrivate = await repo.createCardDraft("bob", cardContent());
  await assert.rejects(repo.createDeckDraft("alice", deckContent([foreignPrivate.cardTemplateId])), { code: "PRIVATE_FOREIGN_CARD" });
  const foreignUnpublished = await repo.createCardDraft("bob", cardContent(), "public");
  await assert.rejects(repo.createDeckDraft("alice", deckContent([foreignUnpublished.cardTemplateId])), { code: "PRIVATE_FOREIGN_CARD" });
});

test("failed Card and Deck publication rolls back inserted versions, roots and publisher adoption", async () => {
  const repo = await setup(); const card = await repo.createCardDraft("alice", cardContent());
  await repo.publishCard("alice", card.cardTemplateId, 0);
  await repo.ensureCardData("alice", card.cardTemplateId, 1);
  const latest = (await repo.getCardVersion(card.cardTemplateId, 1))!.content;
  await repo.saveCardDraft("alice", card.cardTemplateId, 1, { ...latest, intro: { ...latest.intro, title: "Second version" } });
  // Reject adoption update after root/version writes to exercise genuine transaction rollback.
  await repo.db.command({ collMod: "users", validator: { "cardsData.cardTemplateVersion": { $ne: 2 } }, validationLevel: "strict" });
  await assert.rejects(repo.publishCard("alice", card.cardTemplateId, 2));
  assert.equal((await repo.cards().findOne({ cardTemplateId: card.cardTemplateId }))!.latestVersion, 1);
  assert.equal(await repo.getCardVersion(card.cardTemplateId, 2), null);
  assert.equal((await repo.getPersonalUser("alice"))!.cardsData[0].cardTemplateVersion, 1);
  await repo.db.command({ collMod: "users", validator: {} }); await repo.publishCard("alice", card.cardTemplateId, 2);
  const deck = await repo.createDeckDraft("alice", deckContent([card.cardTemplateId]));
  await repo.db.command({ collMod: "users", validator: { "decksData.deckTemplateVersion": { $ne: 1 } }, validationLevel: "strict" });
  await assert.rejects(repo.publishDeck("alice", deck.deckTemplateId, 0));
  assert.equal((await repo.decks().findOne({ deckTemplateId: deck.deckTemplateId }))!.latestVersion, 0);
  assert.equal(await repo.getDeckVersion(deck.deckTemplateId, 1), null);
  assert.equal((await repo.getPersonalUser("alice"))!.decksData.length, 0);
});

test("simultaneous publication with the same revision commits exactly one version", async () => {
  const repo = await setup(); const card = await repo.createCardDraft("alice", cardContent());
  const results = await Promise.allSettled([repo.publishCard("alice", card.cardTemplateId, 0), repo.publishCard("alice", card.cardTemplateId, 0)]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(await repo.cardVersions().countDocuments({ cardTemplateId: card.cardTemplateId }), 1);
});

test("saving content equal to publication clears draft without publishing", async () => {
  const repo = await setup(); const content = cardContent(); const card = await repo.createCardDraft("alice", content);
  await repo.publishCard("alice", card.cardTemplateId, 0);
  await repo.saveCardDraft("alice", card.cardTemplateId, 1, { ...content, intro: { ...content.intro, title: "Changed" } });
  await repo.saveCardDraft("alice", card.cardTemplateId, 2, content);
  assert.equal((await repo.cards().findOne({ cardTemplateId: card.cardTemplateId }))!.draft, null);
  await assert.rejects(repo.publishCard("alice", card.cardTemplateId, 3), { code: "NO_UNPUBLISHED_CHANGES" });
  const deck = await repo.createDeckDraft("alice", deckContent([card.cardTemplateId])); await repo.publishDeck("alice", deck.deckTemplateId, 0);
  await repo.saveDeckDraft("alice", deck.deckTemplateId, 1, deckContent([card.cardTemplateId]));
  assert.equal((await repo.decks().findOne({ deckTemplateId: deck.deckTemplateId }))!.draft, null);
  assert.equal((await repo.decks().findOne({ deckTemplateId: deck.deckTemplateId }))!.latestVersion, 1);
});

test("Step mutations require adopted Deck/Card context, preserve dates/media and retain removed Step state", async () => {
  const repo = await setup(); const content = cardContent(); const card = await repo.createCardDraft("alice", content);
  await repo.publishCard("alice", card.cardTemplateId, 0);
  const deck = await repo.createDeckDraft("alice", deckContent([card.cardTemplateId])); await repo.publishDeck("alice", deck.deckTemplateId, 0);
  await repo.ensureCardData("alice", card.cardTemplateId, 1);
  const stepId = content.steps[0].stepId;
  await repo.setCompletion("alice", deck.deckTemplateId, card.cardTemplateId, stepId, "done");
  await repo.setSignalReading("alice", deck.deckTemplateId, card.cardTemplateId, stepId, 1);
  await repo.setTargetDate("alice", deck.deckTemplateId, card.cardTemplateId, "2026-12-01");
  await assert.rejects(repo.setSignalReading("alice", deck.deckTemplateId, card.cardTemplateId, "0", 5), { code: "STEP_OUTSIDE_ADOPTED_CARD" });
  await assert.rejects(repo.setSignalReading("alice", deck.deckTemplateId, card.cardTemplateId, stepId, 11), { code: "INVALID_SIGNAL_READING" });
  await assert.rejects(repo.setCompletion("bob", deck.deckTemplateId, card.cardTemplateId, stepId, "done"), { code: "WORKING_DECK_REQUIRED" });
  const replacement = createStep("New Step"); const changed = { ...content, steps: [replacement, ...content.steps.slice(1)] };
  await repo.saveCardDraft("alice", card.cardTemplateId, 1, changed); await repo.publishCard("alice", card.cardTemplateId, 2);
  await repo.setCompletion("alice", deck.deckTemplateId, card.cardTemplateId, replacement.stepId, "inProgress");
  await repo.setSignalReading("alice", deck.deckTemplateId, card.cardTemplateId, replacement.stepId, null);
  const data = (await repo.getPersonalUser("alice"))!.cardsData[0];
  assert.equal(data.items.find((item) => item.stepId === stepId)!.completionStatus, "done");
  assert.equal(data.signalReadings.find((signal) => signal.stepId === stepId)!.reading, 1);
  assert.equal(data.items.find((item) => item.stepId === replacement.stepId)!.completionStatus, "inProgress");
  assert.equal(data.targetDate, "2026-12-01");
  await repo.saveDeckDraft("alice", deck.deckTemplateId, 1, deckContent([])); await repo.publishDeck("alice", deck.deckTemplateId, 2);
  assert.equal((await repo.getPersonalUser("alice"))!.cardsData.length, 1);
  await assert.rejects(repo.setSignalReading("alice", deck.deckTemplateId, card.cardTemplateId, replacement.stepId, 5), { code: "CARD_OUTSIDE_WORKING_CONTEXT" });
});

test("skipped-version notes are returned chronologically, excluding blank notes", async () => {
  const repo = await setup(); const content = cardContent(); const card = await repo.createCardDraft("alice", content, "public");
  await repo.publishCard("alice", card.cardTemplateId, 0, "First");
  for (const [index, note] of ["Second", "  ", "Fourth"].entries()) {
    const root = (await repo.cards().findOne({ cardTemplateId: card.cardTemplateId }))!;
    await repo.saveCardDraft("alice", card.cardTemplateId, root.revision, { ...content, intro: { ...content.intro, title: `Version ${index + 2}` } });
    await repo.publishCard("alice", card.cardTemplateId, root.revision + 1, note);
  }
  assert.deepEqual(await repo.cardUpdateNotes("bob", card.cardTemplateId, 1), [{ version: 2, updateNote: "Second" }, { version: 4, updateNote: "Fourth" }]);
});

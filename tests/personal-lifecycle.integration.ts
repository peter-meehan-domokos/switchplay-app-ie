import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { randomUUID } from "node:crypto";
import { MongoClient } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { CardRepository, createFoundationIndexes } from "../src/lib/cards/repository";
import { createStep } from "../src/lib/cards/domain";
import { membershipDTO, workingDTO } from "../src/lib/cards/readModels";
import { resolveWorkingDeck } from "../src/lib/cards/resolvers";
import type { CardContent, DeckContent } from "../src/lib/cards/model";

let server: MongoMemoryReplSet, client: MongoClient, sequence = 0;
before(async () => {
  // Always owned disposable Mongo; no environment URI or Atlas fallback.
  server = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  client = await new MongoClient(server.getUri()).connect();
});
after(async () => { await client?.close(); await server?.stop(); });
async function setup() {
  const db = client.db(`switchplay_test_personal_lifecycle_${sequence++}`);
  await createFoundationIndexes(db);
  const repo = new CardRepository(db, client);
  await repo.users().insertMany(["alice", "bob"].map((_id) => ({ _id, decksData: [], cardsData: [], sharedDeckData: [{ parked: true }] })));
  return repo;
}
const content = (): CardContent => ({ intro: { title: "Practice", description: null, mediaItem: null }, suggestedTargetDate: "",
  steps: [createStep("One"), createStep("Two"), createStep("Three")] });
const deckContent = (ids: string[]): DeckContent => ({ title: "Programme", introduction: null, themes: [], categories: [],
  cadence: { intervalDays: 7 }, labelPrefix: "Card", cards: ids.map((cardTemplateId) => ({ cardTemplateId })) });
async function publicSource(repo: CardRepository) {
  const card = await repo.createCardDraft("bob", content(), "public");
  await repo.publishCard("bob", card.cardTemplateId, 0);
  const deck = await repo.createDeckDraft("bob", deckContent([card.cardTemplateId]), "public");
  await repo.publishDeck("bob", deck.deckTemplateId, 0);
  return { card, deck };
}

test("ordinary private/public canonical creation and Card publication create no personal records", async () => {
  const repo = await setup();
  const own = await repo.createCardDraft("alice", content());
  await repo.publishCard("alice", own.cardTemplateId, 0);
  await repo.createDeckDraft("alice", deckContent([own.cardTemplateId]));
  await repo.createPrivateGraph("alice", randomUUID(), deckContent([]), []);
  await publicSource(repo);
  for (const actor of ["alice", "bob"]) {
    const user = (await repo.getPersonalUser(actor))!;
    assert.deepEqual(user.decksData, []); assert.deepEqual(user.cardsData, []);
    assert.deepEqual(await membershipDTO(repo, actor), []);
  }
});

test("personal entry pins Cards before open; a later source publication cannot substitute latest", async () => {
  const repo = await setup(), { card, deck } = await publicSource(repo);
  await repo.ensureDeckData("alice", deck.deckTemplateId, 1);
  const admitted = (await repo.getPersonalUser("alice"))!;
  assert.equal(admitted.cardsData[0].cardTemplateVersion, 1);
  assert.equal(admitted.decksData[0].openedAt, null); assert.equal(admitted.decksData[0].cadenceAnchorDate, null);
  assert.equal(admitted.decksData[0].activeCardId, null);
  await repo.saveCardDraft("bob", card.cardTemplateId, 1, { ...card.draft!, intro: { ...card.draft!.intro, title: "Version two" } });
  await repo.publishCard("bob", card.cardTemplateId, 2);
  assert.equal((await membershipDTO(repo, "alice"))[0].display!.cards[0].adoptedVersion, 1);
  await repo.openWorkingDeck("alice", deck.deckTemplateId, "2026-10-07");
  const opened = await workingDTO(repo, "alice", deck.deckTemplateId);
  assert.equal(opened.cards[0].adoptedVersion, 1); assert.equal(opened.cards[0].intro.title, "Practice");
  assert.equal(opened.cards[0].permissions!.canUpdateCard, true);
});

test("archived re-entry preserves adoption, timestamps, cadence and shared personal state", async () => {
  const repo = await setup(), { card, deck } = await publicSource(repo);
  await repo.ensureDeckData("alice", deck.deckTemplateId, 1);
  await repo.openWorkingDeck("alice", deck.deckTemplateId, "2026-10-07");
  await repo.setCompletion("alice", deck.deckTemplateId, card.cardTemplateId, card.draft!.steps[0].stepId, "skipped");
  await repo.users().updateOne({ _id: "alice" }, { $set: { "decksData.0.sharedWithUserIds": [{ parked: "raw" }] } });
  await repo.archiveDeckData("alice", deck.deckTemplateId);
  const before = (await repo.getPersonalUser("alice"))!;
  const additional = await repo.createCardDraft("bob", content(), "public"); await repo.publishCard("bob", additional.cardTemplateId, 0);
  await repo.saveDeckDraft("bob", deck.deckTemplateId, 1, deckContent([card.cardTemplateId, additional.cardTemplateId]));
  await repo.publishDeck("bob", deck.deckTemplateId, 2);
  await Promise.all(Array.from({ length: 4 }, () => repo.ensureDeckData("alice", deck.deckTemplateId, 2)));
  const after = (await repo.getPersonalUser("alice"))!;
  assert.equal(after.decksData.length, 1); assert.equal(after.cardsData.length, 1);
  assert.deepEqual(after.cardsData, before.cardsData);
  assert.deepEqual(after.decksData[0], { ...before.decksData[0], archivedAt: null,
    membershipRevision: (before.decksData[0].membershipRevision ?? 0) + 1, updatedAt: after.decksData[0].updatedAt });
  await repo.archiveDeckData("alice", deck.deckTemplateId); await repo.reactivateDeckData("alice", deck.deckTemplateId);
  assert.deepEqual((await repo.getPersonalUser("alice"))!.decksData[0].createdAt, before.decksData[0].createdAt);
});

test("entry reuses global adopted CardData and pins missing Cards to published versions without drafts", async () => {
  const repo = await setup(), { card, deck } = await publicSource(repo);
  await repo.ensureDeckData("alice", deck.deckTemplateId, 1);
  const original = (await repo.getPersonalUser("alice"))!.cardsData[0];
  await repo.saveCardDraft("bob", card.cardTemplateId, 1, { ...card.draft!, intro: { ...card.draft!.intro, title: "New version" } });
  await repo.publishCard("bob", card.cardTemplateId, 2);
  const added = await repo.createCardDraft("bob", content(), "public"); await repo.publishCard("bob", added.cardTemplateId, 0);
  await repo.saveCardDraft("bob", added.cardTemplateId, 1, { ...added.draft!, intro: { ...added.draft!.intro, title: "Unpublished" } });
  const second = await repo.createDeckDraft("bob", deckContent([card.cardTemplateId, added.cardTemplateId]), "public");
  await repo.publishDeck("bob", second.deckTemplateId, 0);
  await repo.ensureDeckData("alice", second.deckTemplateId, 1);
  const user = (await repo.getPersonalUser("alice"))!;
  assert.equal(user.decksData.length, 2); assert.equal(user.cardsData.length, 2);
  assert.deepEqual(user.cardsData[0], original);
  assert.equal(user.cardsData[1].cardTemplateVersion, 1);
  const working = await workingDTO(repo, "alice", second.deckTemplateId);
  assert.equal(working.cards[0].adoptedVersion, 1); assert.equal(working.cards[1].intro.title, "Practice");
});

test("private first publication and missing Card initialization roll back together on failure", async () => {
  const repo = await setup(), { card } = await publicSource(repo);
  await repo.ensureCardData("alice", card.cardTemplateId, 1, "2030-01-01");
  const own = await repo.createCardDraft("alice", content()); await repo.publishCard("alice", own.cardTemplateId, 0);
  const deck = await repo.createDeckDraft("alice", deckContent([card.cardTemplateId, own.cardTemplateId]));
  const before = (await repo.getPersonalUser("alice"))!;
  await repo.db.command({ collMod: "users", validator: { "decksData.0": { $exists: false } }, validationLevel: "strict" });
  await assert.rejects(repo.publishDeck("alice", deck.deckTemplateId, 0));
  assert.equal(await repo.getDeckVersion(deck.deckTemplateId, 1), null);
  assert.equal((await repo.decks().findOne({ deckTemplateId: deck.deckTemplateId }))!.revision, 0);
  assert.deepEqual(await repo.getPersonalUser("alice"), before);
  await repo.db.command({ collMod: "users", validator: {} });
  await repo.publishDeck("alice", deck.deckTemplateId, 0);
  const after = (await repo.getPersonalUser("alice"))!;
  assert.equal(after.decksData[0].deckTemplateVersion, 1); assert.equal(after.cardsData.length, 2);
  assert.deepEqual(after.cardsData[0], before.cardsData[0]);
  assert.equal(after.cardsData[1].cardTemplateVersion, 1);
});

test("entry fails atomically when a selected Card version is missing", async () => {
  const repo = await setup(), { card, deck } = await publicSource(repo);
  await repo.cardVersions().deleteOne({ cardTemplateId: card.cardTemplateId, version: 1 });
  await assert.rejects(repo.ensureDeckData("alice", deck.deckTemplateId, 1), { code: "MISSING_CARD_VERSION" });
  assert.deepEqual((await repo.getPersonalUser("alice"))!.decksData, []);
  assert.deepEqual((await repo.getPersonalUser("alice"))!.cardsData, []);
});

test("working reads reject incomplete personal graphs without inventing adoption or state", async () => {
  const repo = await setup(), { card, deck } = await publicSource(repo);
  await repo.ensureDeckData("alice", deck.deckTemplateId, 1);
  await repo.users().updateOne({ _id: "alice" }, { $set: { cardsData: [] } });
  const before = await repo.getPersonalUser("alice");
  await assert.rejects(repo.openWorkingDeck("alice", deck.deckTemplateId, "2026-10-07"), { code: "MISSING_CARD_DATA" });
  await assert.rejects(resolveWorkingDeck(repo, "alice", deck.deckTemplateId), { code: "MISSING_CARD_DATA" });
  const unavailable = (await membershipDTO(repo, "alice"))[0];
  assert.equal(unavailable.availability, "unavailable"); assert.equal(unavailable.unavailableReason, "MISSING_CARD_DATA");
  assert.deepEqual(await repo.getPersonalUser("alice"), before);
  await repo.ensureDeckData("alice", deck.deckTemplateId, 1); // Explicit entry repairs missing coverage, not working open.
  assert.equal((await repo.getPersonalUser("alice"))!.cardsData[0].cardTemplateId, card.cardTemplateId);
});

test("later publisher Deck adoption pins newly referenced Cards even while archived", async () => {
  const repo = await setup(), { card } = await publicSource(repo);
  const deck = await repo.createDeckDraft("alice", deckContent([])); await repo.publishDeck("alice", deck.deckTemplateId, 0);
  await repo.openWorkingDeck("alice", deck.deckTemplateId, "2026-10-07"); await repo.archiveDeckData("alice", deck.deckTemplateId);
  const archived = (await repo.getPersonalUser("alice"))!.decksData[0];
  await repo.saveDeckDraft("alice", deck.deckTemplateId, 1, deckContent([card.cardTemplateId]));
  await repo.publishDeck("alice", deck.deckTemplateId, 2);
  const admitted = (await repo.getPersonalUser("alice"))!;
  assert.equal(admitted.decksData[0].deckTemplateVersion, 2); assert.deepEqual(admitted.decksData[0].archivedAt, archived.archivedAt);
  assert.equal(admitted.cardsData[0].cardTemplateVersion, 1);
  await repo.saveCardDraft("bob", card.cardTemplateId, 1, { ...card.draft!, intro: { ...card.draft!.intro, title: "New source" } });
  await repo.publishCard("bob", card.cardTemplateId, 2);
  await repo.reactivateDeckData("alice", deck.deckTemplateId); await repo.openWorkingDeck("alice", deck.deckTemplateId, "2027-01-01");
  assert.equal((await workingDTO(repo, "alice", deck.deckTemplateId)).cards[0].adoptedVersion, 1);
  assert.equal((await repo.getPersonalUser("alice"))!.decksData[0].cadenceAnchorDate, "2026-10-07");
});

test("ordinary owner publication preserves skipped/completion/readings through content edits and reorder", async () => {
  const repo = await setup(), original = content();
  const card = await repo.createCardDraft("alice", original, "public"); await repo.publishCard("alice", card.cardTemplateId, 0);
  const deck = await repo.createDeckDraft("alice", deckContent([card.cardTemplateId])); await repo.publishDeck("alice", deck.deckTemplateId, 0);
  await repo.ensureCardData("bob", card.cardTemplateId, 1);
  await repo.setCompletion("alice", deck.deckTemplateId, card.cardTemplateId, original.steps[0].stepId, "skipped");
  await repo.setCompletion("alice", deck.deckTemplateId, card.cardTemplateId, original.steps[1].stepId, "done");
  await repo.setSignalReading("alice", deck.deckTemplateId, card.cardTemplateId, original.steps[0].stepId, 1);
  await repo.setReflection("alice", deck.deckTemplateId, card.cardTemplateId, "Current reflection");
  const before = (await repo.getPersonalUser("alice"))!.cardsData[0];
  const steps = original.steps.map((step) => ({ ...step, title: "Reworded", description: "Changed activity",
    mediaItem: { id: "changed-video", mediaType: "video" as const, provider: "cloudflare-stream" as const, assetId: "trusted-existing", src: "https://iframe.videodelivery.net/trusted-existing", description: "Different video" } })).reverse();
  await repo.saveCardDraft("alice", card.cardTemplateId, 1, { ...original, steps }); await repo.publishCard("alice", card.cardTemplateId, 2);
  const after = (await repo.getPersonalUser("alice"))!.cardsData[0];
  assert.deepEqual({ ...after, cardTemplateVersion: before.cardTemplateVersion, updatedAt: before.updatedAt }, before);
  const working = await workingDTO(repo, "alice", deck.deckTemplateId);
  assert.equal(working.cards[0].steps[2].completionStatus, "skipped"); assert.equal(working.cards[0].steps[1].completionStatus, "done");
  assert.equal(working.cards[0].signals[2].reading, 1); assert.equal(working.cards[0].signals[1].reading, null);
  assert.equal((await repo.getPersonalUser("bob"))!.cardsData[0].cardTemplateVersion, 1);
});

test("null personal pointers are rejected rather than repaired by publication or working reads", async () => {
  const repo = await setup(), { deck, card } = await publicSource(repo);
  await assert.rejects(repo.ensureDeckData("alice", deck.deckTemplateId, null as never), { code: "INVALID_ADOPTED_VERSION" });
  await assert.rejects(repo.ensureCardData("alice", card.cardTemplateId, null as never), { code: "INVALID_ADOPTED_VERSION" });
  await repo.ensureDeckData("bob", deck.deckTemplateId, 1);
  await repo.users().updateOne({ _id: "bob" }, { $set: { "decksData.0.deckTemplateVersion": null } });
  const unavailable = (await membershipDTO(repo, "bob"))[0];
  assert.equal(unavailable.availability, "unavailable"); assert.equal(unavailable.unavailableReason, "INVALID_ADOPTED_VERSION");
  await assert.rejects(resolveWorkingDeck(repo, "bob", deck.deckTemplateId), { code: "INVALID_ADOPTED_VERSION" });
});

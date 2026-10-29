import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { MongoClient } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { CardRepository, createFoundationIndexes } from "../src/lib/cards/repository";
import { createDefaultCardContent, createDefaultDeckContent } from "../src/lib/cards/creatorDefaults";
import { projectPersonalLearning } from "../src/lib/cards/learning";
import { ensurePersonalLearningInSession, mutatePersonalLearningInSession } from "../src/lib/cards/personalLearning";
import { workingDTO } from "../src/lib/cards/readModels";
import type { CardTemplateVersion } from "../src/lib/cards/model";

let mongo: MongoMemoryReplSet, client: MongoClient, sequence = 0;
before(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  client = await new MongoClient(mongo.getUri()).connect();
});
after(async () => { await client?.close(); await mongo?.stop(); });

async function fixture() {
  const repo = new CardRepository(client.db(`switchplay_test_shared_learning_${sequence++}`), client);
  await createFoundationIndexes(repo.db);
  await repo.users().insertMany(["alice", "bob"].map(_id => ({ _id, decksData: [], cardsData: [] })));
  const content = { ...createDefaultCardContent(["a", "b", "c"]),
    intro: { title: "Shared practice", description: null, mediaItem: null }, suggestedTargetDate: "2027-06-01" };
  const root = await repo.createCardDraft("bob", content, "public");
  await repo.publishCard("bob", root.cardTemplateId, 0);
  await repo.saveCardDraft("bob", root.cardTemplateId, 1, { ...content, steps: [content.steps[1], content.steps[0], content.steps[2]] });
  await repo.publishCard("bob", root.cardTemplateId, 2, "Reorder");
  await repo.saveCardDraft("bob", root.cardTemplateId, 3, { ...content, steps: [...content.steps.slice(0, 2), { ...content.steps[2], stepId: "d" }] });
  await repo.publishCard("bob", root.cardTemplateId, 4, "Replacement");
  const versions = await repo.cardVersions().find({ cardTemplateId: root.cardTemplateId }).sort({ version: 1 }).toArray();
  return { repo, id: root.cardTemplateId, versions };
}
async function ensure(repo: CardRepository, selected: CardTemplateVersion, scheduling: "personal" | "experience" = "experience") {
  await repo.transaction(session => ensurePersonalLearningInSession(repo, "alice", selected, session, { scheduling }));
}
async function deck(repo: CardRepository, ids: string[], owner = "bob") {
  const root = await repo.createDeckDraft(owner, { ...createDefaultDeckContent([]), title: "Assignment", cards: ids.map(cardTemplateId => ({ cardTemplateId })) }, "public");
  await repo.publishDeck(owner, root.deckTemplateId, 0);
  return root.deckTemplateId;
}

test("competing selected versions materialize one personal authority without imposing group dates", async () => {
  const { repo, id, versions } = await fixture();
  await Promise.all([versions[0], versions[2], versions[1], versions[0]].map(version => ensure(repo, version)));
  const cards = (await repo.getPersonalUser("alice"))!.cardsData;
  assert.equal(cards.length, 1); assert.equal(cards[0].cardTemplateId, id); assert.equal(cards[0].targetDate, null);
  assert.ok([1, 2, 3].includes(cards[0].cardTemplateVersion));
  assert.deepEqual(cards[0].tests, []); assert.equal(cards[0].reflection, "");
});

test("concurrent cross-version narrow writes preserve obsolete Steps, adoption, dates and every private field", async () => {
  const { repo, id, versions } = await fixture(); await ensure(repo, versions[0]);
  await repo.users().updateOne({ _id: "alice" }, { $set: {
    "cardsData.0.targetDate": "2027-02-03", "cardsData.0.reflection": "private reflection", "cardsData.0.personalInfoCardIds": ["private-info"],
    "cardsData.0.mediaItems": [{ id: "private-image", mediaType: "image", src: "https://private.test/image", description: "private" }],
    "cardsData.0.tests": [{ id: "private-test", date: "2026-10-29", result: true, createdAt: new Date() }],
    "cardsData.0.chats": [{ id: "private-chat", deckTemplateId: "elsewhere", comments: [] }],
  } });
  const before = structuredClone((await repo.getPersonalUser("alice"))!.cardsData[0]);
  const storageProjection = await repo.getPersonalLearning("alice", id);
  assert.deepEqual(Object.keys(storageProjection!.cardsData[0]).sort(), ["cardTemplateId", "items", "signalReadings"]);
  assert.ok(!JSON.stringify(storageProjection).includes("private"));
  await Promise.all([
    repo.transaction(session => mutatePersonalLearningInSession(repo, "alice", versions[0], { kind: "completion", stepId: "c", completionStatus: "skipped" }, session)),
    repo.transaction(session => mutatePersonalLearningInSession(repo, "alice", versions[2], { kind: "completion", stepId: "d", completionStatus: "done" }, session)),
    repo.transaction(session => mutatePersonalLearningInSession(repo, "alice", versions[1], { kind: "signal", stepId: "a", reading: 6.42 }, session)),
  ]);
  const after = (await repo.getPersonalUser("alice"))!.cardsData[0];
  assert.deepEqual({ ...after, items: before.items, signalReadings: before.signalReadings, updatedAt: before.updatedAt }, before);
  for (const version of versions) {
    const projected = projectPersonalLearning(id, version.version, version.content, [after]);
    assert.equal(projected.signalReadings.find(signal => signal.stepId === "a")!.reading, 6.42);
    assert.ok(!JSON.stringify(projected).includes("private"));
  }
  assert.equal(after.items.find(item => item.stepId === "c")!.completionStatus, "skipped");
  assert.equal(after.items.find(item => item.stepId === "d")!.completionStatus, "done");
  assert.deepEqual((await repo.getPersonalUser("bob"))!.cardsData, []);
});

test("experience materialization preserves an existing date and ordinary personal first-open scheduling remains unchanged", async () => {
  const { repo, id, versions } = await fixture();
  await ensure(repo, versions[0]); assert.equal((await repo.getPersonalUser("alice"))!.cardsData[0].targetDate, null);
  const deckId = await deck(repo, [id]); await repo.ensureDeckData("alice", deckId, 1);
  await repo.openWorkingDeck("alice", deckId, "2026-10-29");
  assert.equal((await repo.getPersonalUser("alice"))!.cardsData[0].targetDate, "2027-06-01");
  await repo.setTargetDate("alice", deckId, id, "2028-02-03");
  await ensure(repo, versions[2]);
  const card = (await repo.getPersonalUser("alice"))!.cardsData[0];
  assert.equal(card.targetDate, "2028-02-03"); assert.equal(card.cardTemplateVersion, 1);
});

test("unknown Steps and duplicate records reject without changing personal data", async () => {
  const { repo, versions } = await fixture(); await ensure(repo, versions[0]);
  const before = await repo.getPersonalUser("alice");
  await assert.rejects(repo.transaction(session => mutatePersonalLearningInSession(repo, "alice", versions[0],
    { kind: "completion", stepId: "d", completionStatus: "done" }, session)), { code: "STEP_OUTSIDE_ADOPTED_CARD" });
  assert.deepEqual(await repo.getPersonalUser("alice"), before);
  await repo.users().updateOne({ _id: "alice" }, { $push: { cardsData: structuredClone(before!.cardsData[0]) } });
  const duplicate = await repo.getPersonalUser("alice");
  await assert.rejects(ensure(repo, versions[2]), { code: "AMBIGUOUS_CARD_DATA" });
  await assert.rejects(repo.transaction(session => mutatePersonalLearningInSession(repo, "alice", versions[0],
    { kind: "signal", stepId: "a", reading: 5 }, session)), { code: "AMBIGUOUS_CARD_DATA" });
  assert.deepEqual(await repo.getPersonalUser("alice"), duplicate);
});

test("failed first mutation rolls back materialization and does not initialize any date", async () => {
  const { repo, versions } = await fixture();
  await assert.rejects(repo.transaction(async session => {
    await ensurePersonalLearningInSession(repo, "alice", versions[0], session, { scheduling: "experience" });
    await mutatePersonalLearningInSession(repo, "alice", versions[0], { kind: "signal", stepId: "unknown", reading: 7 }, session);
  }));
  assert.deepEqual((await repo.getPersonalUser("alice"))!.cardsData, []);
});

test("narrow storage lookup treats Card IDs literally and excludes unrelated private records", async () => {
  const { repo, versions } = await fixture(); await ensure(repo, versions[0]);
  const own = (await repo.getPersonalUser("alice"))!.cardsData[0];
  await repo.users().updateOne({ _id: "alice" }, { $push: { cardsData: { ...own, cardTemplateId: "$literal", reflection: "never disclose" } } });
  const result = await repo.getPersonalLearning("alice", "$literal");
  assert.equal(result!.cardsData.length, 1); assert.equal(result!.cardsData[0].cardTemplateId, "$literal");
  assert.ok(!JSON.stringify(result).includes("never disclose"));
});

test("legacy personal Deck removal retains assignment evidence without restoring old navigation", async () => {
  const { repo, id, versions } = await fixture();
  await repo.ensureCardData("alice", id, 1);
  const deckId = await deck(repo, [id]); await repo.ensureDeckData("alice", deckId, 1);
  assert.deepEqual((await repo.getPersonalUser("alice"))!.retainedCardAssignments, [{ cardTemplateId: id, version: 1 }]);
  const cardReview = (await repo.reviewUpdate("alice", "card", id)).review!;
  await repo.adoptUpdate("alice", cardReview.command);
  assert.deepEqual((await repo.getPersonalUser("alice"))!.retainedCardAssignments, [{ cardTemplateId: id, version: 3 }]);
  // Represent a pre-feature membership: the prior adopted composition itself
  // must seed retention before removal, not a fabricated old-version history.
  await repo.users().updateOne({ _id: "alice" }, { $unset: { retainedCardAssignments: "" } });
  const root = (await repo.decks().findOne({ deckTemplateId: deckId }))!;
  await repo.saveDeckDraft("bob", deckId, root.revision, { ...createDefaultDeckContent([]), title: "Removed" });
  await repo.publishDeck("bob", deckId, root.revision + 1, "Remove Card");
  await repo.adoptUpdate("alice", (await repo.reviewUpdate("alice", "deck", deckId)).review!.command);
  const user = (await repo.getPersonalUser("alice"))!;
  assert.deepEqual(user.retainedCardAssignments, [{ cardTemplateId: id, version: 3 }]);
  assert.equal(user.cardsData.length, 1); assert.deepEqual((await workingDTO(repo, "alice", deckId)).cards, []);
  await assert.rejects(repo.setCompletion("alice", deckId, id, "a", "done"), { code: "CARD_OUTSIDE_WORKING_CONTEXT" });
  assert.equal(versions.length, 3);
});

test("owner Deck republication seeds the old composition before automatic adoption removes it", async () => {
  const { repo, id } = await fixture(), deckId = await deck(repo, [id], "alice");
  await repo.ensureDeckData("alice", deckId, 1);
  await repo.users().updateOne({ _id: "alice" }, { $unset: { retainedCardAssignments: "" } });
  const root = (await repo.decks().findOne({ deckTemplateId: deckId }))!;
  await repo.saveDeckDraft("alice", deckId, root.revision, { ...createDefaultDeckContent([]), title: "Without Card" });
  await repo.publishDeck("alice", deckId, root.revision + 1, "Remove");
  assert.deepEqual((await repo.getPersonalUser("alice"))!.retainedCardAssignments, [{ cardTemplateId: id, version: 3 }]);
  assert.deepEqual((await workingDTO(repo, "alice", deckId)).cards, []);
});

test("new publication alone never advances retained assigned versions", async () => {
  const { repo, id } = await fixture();
  await repo.ensureCardData("alice", id, 1);
  await repo.ensureDeckData("alice", await deck(repo, [id]), 1);
  assert.deepEqual((await repo.getPersonalUser("alice"))!.retainedCardAssignments, [{ cardTemplateId: id, version: 1 }]);
  assert.equal((await repo.cards().findOne({ cardTemplateId: id }))!.latestVersion, 3);
});

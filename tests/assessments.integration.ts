import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { randomUUID } from "node:crypto";
import { MongoClient } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { CardRepository, createFoundationIndexes } from "../src/lib/cards/repository";
import { mutateAssessment, readAssessmentList } from "../src/lib/assessments/repository";
import { AssessmentConflict, type AssessmentCommand, type AssessmentSource } from "../src/lib/assessments/contracts";
import { cardFixture, deckFixture, frameworkFixtures } from "./fixtures/frameworks";
import { personalCardHistoryDTO } from "../src/lib/cards/readModels";
import { forkCardContent } from "../src/lib/cards/forks";

let mongo: MongoMemoryReplSet, client: MongoClient, sequence = 0;
before(async () => { mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } }); client = await new MongoClient(mongo.getUri()).connect(); });
after(async () => { await client?.close(); await mongo?.stop(); });
const source: AssessmentSource = { kind: "card", cardTemplateId: "original" };
const item: AssessmentSource = { kind: "item", itemId: "practice-empty" };
function add(target: AssessmentSource = source, id = "test-1", revision = 0): Extract<AssessmentCommand, { action: "add" }> {
  return { viewerUserId: "alice", source: target, id, expectedRevision: revision, action: "add", date: "2026-10-11", result: true,
    ...(target.kind === "card" ? { deckTemplateId: "active" } : {}) };
}
function edit(target: AssessmentSource, id: string, revision: number): AssessmentCommand {
  return { viewerUserId: "alice", source: target, id, expectedRevision: revision, action: "update", date: "2026-10-10", result: false };
}
function remove(target: AssessmentSource, id: string, revision: number): AssessmentCommand {
  return { viewerUserId: "alice", source: target, id, expectedRevision: revision, action: "delete" };
}
async function setup() {
  const repo = new CardRepository(client.db(`switchplay_test_assessments_${sequence++}`), client); await createFoundationIndexes(repo.db);
  const cards = [cardFixture("original"), cardFixture("fork", "original"), cardFixture("orphan")];
  cards[1].data.historySourceCardTemplateId = "original";
  const deck = deckFixture("active", ["original", "fork"]);
  await repo.cards().insertMany(cards.map((card) => structuredClone(card.root)));
  await repo.cardVersions().insertMany(cards.map((card) => structuredClone(card.version)));
  await repo.decks().insertOne(deck.root); await repo.deckVersions().insertOne(deck.version);
  await repo.users().insertMany([{ _id: "alice", decksData: [deck.data], cardsData: cards.map((card) => card.data) },
    { _id: "bob", decksData: [], cardsData: [] }]);
  return { repo, cards };
}
const mutate = (repo: CardRepository, command: AssessmentCommand, catalogue = frameworkFixtures()) => mutateAssessment(repo, "alice", command, catalogue);

test("Card CRUD pins its source, timestamp and actor; unrelated personal state and adopted versions survive", async () => {
  const { repo } = await setup();
  await repo.users().updateOne({ _id: "alice" }, { $set: { "cardsData.0.reflection": "Reflection", "cardsData.0.targetDate": "2027-01-01",
    "cardsData.0.mediaItems": [{ id: "evidence", src: "fixture", retained: true }], "cardsData.0.chats": [{ id: "chat", retained: true }],
    "cardsData.0.items.0.completionStatus": "done", "cardsData.0.signalReadings.0.reading": 7 } });
  const before = (await repo.getPersonalUser("alice"))!;
  assert.equal((await readAssessmentList(repo, "alice", source)).revision, 0);
  const created = await mutate(repo, add()); assert.equal(created.revision, 1); assert.equal(created.tests.length, 1);
  const updated = await mutate(repo, edit(source, "test-1", 1)); assert.equal(updated.tests[0].result, false);
  assert.equal(updated.tests[0].createdAt, created.tests[0].createdAt); assert.equal(updated.tests[0].id, "test-1");
  const deleted = await mutate(repo, remove(source, "test-1", 2)); assert.equal(deleted.revision, 3); assert.deepEqual(deleted.tests, []);
  const after = (await repo.getPersonalUser("alice"))!;
  const strip = (data: typeof before.cardsData[number]) => { const { tests, testsRevision, updatedAt, ...rest } = data; void tests; void testsRevision; void updatedAt; return rest; };
  assert.deepEqual(strip(after.cardsData[0]), strip(before.cardsData[0])); assert.deepEqual(after.cardsData.slice(1), before.cardsData.slice(1));
  assert.deepEqual(after.decksData, before.decksData);
});

test("direct Item CRUD needs no Deck or CardData; removed Items retain manageable results and projections", async () => {
  const { repo } = await setup(); await repo.users().updateOne({ _id: "alice" }, { $set: { decksData: [], cardsData: [] } });
  const created = await mutate(repo, add(item)); assert.equal(created.tests.length, 1); assert.equal(created.revision, 1);
  let user = (await repo.getPersonalUser("alice"))!;
  assert.equal(user.itemTests![0].itemId, "practice-empty"); assert.equal(user.itemTestsRevision, 1);
  const updated = await mutate(repo, edit(item, "test-1", 1), []); assert.equal(updated.tests[0].createdAt, created.tests[0].createdAt);
  assert.equal(updated.tests[0].result, false);
  await assert.rejects(mutate(repo, add(item, "new", 2), []), { code: "ITEM_ASSESSMENT_CONTEXT_REQUIRED" });
  const deleted = await mutate(repo, remove(item, "test-1", 2), []); assert.deepEqual(deleted.tests, []);
  assert.equal((await mutate(repo, remove(item, "test-1", 2), [])).outcome, "already-absent");
  user = (await repo.getPersonalUser("alice"))!; assert.deepEqual(user.cardsData, []); assert.deepEqual(user.decksData, []);
});

test("new fork tests stay on the fork; inherited mutations change only the original even after archival or canonical removal", async () => {
  const { repo } = await setup(); await mutate(repo, add());
  const forkSource: AssessmentSource = { kind: "card", cardTemplateId: "fork" };
  await mutate(repo, add(forkSource, "fork-test"));
  await repo.archiveDeckData("alice", "active");
  await repo.cards().deleteOne({ cardTemplateId: "original" });
  await repo.cardVersions().deleteMany({ cardTemplateId: "original" });
  await mutate(repo, edit(source, "test-1", 1));
  const history = await personalCardHistoryDTO(repo, "alice", "fork");
  assert.equal(history.segments[0].tests[0].id, "fork-test"); assert.equal(history.segments[1].tests[0].result, false);
  await mutate(repo, remove(source, "test-1", 2));
  const user = (await repo.getPersonalUser("alice"))!;
  assert.deepEqual(user.cardsData[0].tests, []); assert.equal(user.cardsData[1].tests.length, 1);
  await assert.rejects(mutate(repo, add(forkSource, "new-fork-test", 1)), { code: "WORKING_DECK_REQUIRED" });
  assert.equal(user.decksData[0].archivedAt instanceof Date, true);
});

test("actual fork creation/publication retains source tests and initializes no duplicated events", async () => {
  const { repo, cards } = await setup(); await mutate(repo, add());
  await repo.cards().updateOne({ cardTemplateId: "original" }, { $set: { visibility: "public" } });
  await repo.cardVersions().updateOne({ cardTemplateId: "original", version: 1 }, { $set: { visibility: "public" } });
  const stepIds = [randomUUID(), randomUUID(), randomUUID()], id = randomUUID();
  const content = forkCardContent(cards[0].version.content, { cardTemplateId: "original", version: 1 }, stepIds);
  content.intro.title = "Meaningful fork";
  const before = (await repo.getPersonalUser("alice"))!.cardsData[0];
  await repo.createCardFork("alice", { source: { cardTemplateId: "original", version: 1 }, cardTemplateId: id, stepIds, content,
    context: { kind: "my-decks", deckTemplateId: "active" } });
  await repo.publishCard("alice", id, 0);
  const user = (await repo.getPersonalUser("alice"))!;
  assert.deepEqual(user.cardsData[0], before); const fork = user.cardsData.find((card) => card.cardTemplateId === id)!;
  assert.deepEqual(fork.tests, []); assert.equal(fork.historySourceCardTemplateId, "original");
});

test("ownership, orphan state and Library availability do not authorize Add or initialize personal records", async () => {
  const { repo } = await setup(); const before = await repo.getPersonalUser("alice");
  await assert.rejects(mutate(repo, add({ kind: "card", cardTemplateId: "orphan" })), { code: "CARD_OUTSIDE_WORKING_CONTEXT" });
  await assert.rejects(mutate(repo, { ...add(), deckTemplateId: "missing" }), { code: "WORKING_DECK_REQUIRED" });
  await assert.rejects(mutateAssessment(repo, "bob", { ...add(), viewerUserId: "bob" }), { code: "ASSESSMENT_FORBIDDEN" });
  await assert.rejects(mutate(repo, add({ kind: "card", cardTemplateId: "missing" })), { code: "ASSESSMENT_FORBIDDEN" });
  await assert.rejects(mutate(repo, add({ kind: "item", itemId: "forged-item" })), { code: "ITEM_ASSESSMENT_CONTEXT_REQUIRED" });
  assert.deepEqual(await repo.getPersonalUser("alice"), before); assert.deepEqual((await repo.getPersonalUser("bob"))!.cardsData, []);
});

test("public foreign canonical ancestry never grants the creator's personal assessments", async () => {
  const { repo, cards } = await setup(); await mutate(repo, add());
  await repo.cards().updateOne({ cardTemplateId: "fork" }, { $set: { ownerUserId: "bob", visibility: "public" } });
  await repo.cardVersions().updateOne({ cardTemplateId: "fork", version: 1 }, { $set: { visibility: "public" } });
  const bob = structuredClone(cards[1].data); bob.tests = [{ id: "private-bob-result", date: "2026-10-11", result: false, createdAt: new Date() }];
  delete bob.historySourceCardTemplateId;
  await repo.users().updateOne({ _id: "bob" }, { $set: { cardsData: [bob] } });
  const forkSource: AssessmentSource = { kind: "card", cardTemplateId: "fork" };
  const own = await mutate(repo, add(forkSource, "alice-result")); assert.equal(own.tests.length, 1);
  const history = await personalCardHistoryDTO(repo, "alice", "fork"); assert.equal(JSON.stringify(history).includes("private-bob-result"), false);
  await assert.rejects(mutate(repo, edit(forkSource, "private-bob-result", 1)), { code: "ASSESSMENT_NOT_FOUND" });
  await assert.rejects(mutateAssessment(repo, "bob", edit(source, "test-1", 1)), { code: "ASSESSMENT_SESSION_CONFLICT" });
  await assert.rejects(readAssessmentList(repo, "bob", source), { code: "ASSESSMENT_FORBIDDEN" });
  assert.equal((await readAssessmentList(repo, "bob", forkSource)).tests[0].id, "private-bob-result");
});

test("identical concurrent submissions reconcile once; conflicting edits cannot overwrite each other", async () => {
  const { repo } = await setup(); const adds = await Promise.all([mutate(repo, add()), mutate(repo, add())]);
  assert.deepEqual(adds.map((result) => result.outcome).sort(), ["already-present", "changed"]);
  assert.equal((await readAssessmentList(repo, "alice", source)).tests.length, 1);
  const edit1 = edit(source, "test-1", 1), edit2 = { ...edit1, result: true, date: "2026-10-09" };
  const outcomes = await Promise.allSettled([mutate(repo, edit1), mutate(repo, edit2)]);
  assert.equal(outcomes.filter((outcome) => outcome.status === "fulfilled").length, 1);
  const rejected = outcomes.find((outcome) => outcome.status === "rejected");
  assert.equal(rejected?.status, "rejected"); if (rejected?.status === "rejected") assert.ok(rejected.reason instanceof AssessmentConflict);
  const list = await readAssessmentList(repo, "alice", source); assert.equal(list.revision, 2);
});

test("concurrent Add/Delete and stale retries never resurrect a deleted result", async () => {
  const { repo } = await setup(); const cmd = add(); await mutate(repo, cmd);
  await mutate(repo, remove(source, "test-1", 1));
  await assert.rejects(mutate(repo, cmd), AssessmentConflict);
  await assert.rejects(mutate(repo, edit(source, "test-1", 1)), AssessmentConflict);
  assert.deepEqual((await readAssessmentList(repo, "alice", source)).tests, []);
  const competing = await Promise.allSettled([mutate(repo, add(source, "new", 2)), mutate(repo, remove(source, "test-1", 1))]);
  assert.equal(competing.filter((outcome) => outcome.status === "fulfilled").length, 2); // stale Delete is a read-only acknowledgement.
  assert.deepEqual((await readAssessmentList(repo, "alice", source)).tests.map((test) => test.id), ["new"]);
  const race = await Promise.allSettled([mutate(repo, add(source, "another", 3)), mutate(repo, remove(source, "new", 3))]);
  assert.equal(race.filter((outcome) => outcome.status === "fulfilled").length, 1);
});

test("lost-response retries recognise committed state without replaying timestamps or overwriting newer changes", async () => {
  const { repo } = await setup(); const cmd = add(); const saved = await mutate(repo, cmd);
  const retried = await mutate(repo, cmd); assert.equal(retried.outcome, "already-present"); assert.deepEqual(retried.tests, saved.tests); assert.equal(retried.revision, 1);
  const change = edit(source, "test-1", 1); await mutate(repo, change);
  assert.equal((await mutate(repo, change)).outcome, "already-present");
  await assert.rejects(mutate(repo, cmd), AssessmentConflict);
  const deletion = remove(source, "test-1", 2); await mutate(repo, deletion);
  assert.equal((await mutate(repo, deletion)).outcome, "already-absent");
  await assert.rejects(mutate(repo, change), AssessmentConflict);
});

test("fresh duplicate IDs are rejected and newer publications are never adopted by assessment creation", async () => {
  const { repo, cards } = await setup();
  const newer = structuredClone(cards[0].version); newer.version = 2;
  newer.content.steps[0].title = "Newer published wording";
  await repo.cardVersions().insertOne(newer); await repo.cards().updateOne({ cardTemplateId: "original" }, { $set: { latestVersion: 2 } });
  const created = await mutate(repo, add());
  await assert.rejects(mutate(repo, add(source, "test-1", 1)), { code: "DUPLICATE_ASSESSMENT_ID_CONFLICT" });
  assert.deepEqual(await readAssessmentList(repo, "alice", source), {
    viewerUserId: created.viewerUserId, source: created.source, revision: created.revision, tests: created.tests });
  assert.equal((await repo.getPersonalUser("alice"))!.cardsData[0].cardTemplateVersion, 1);
  await repo.archiveDeckData("alice", "active");
  assert.equal((await mutate(repo, add())).outcome, "already-present"); // A retry acknowledges existing state; it creates nothing.
  const configured = await mutate(repo, add(item));
  assert.equal((await mutate(repo, add(item), [])).outcome, "already-present");
  assert.equal(configured.revision, 1);
});

test("direct Item list revision is global, IDs cannot move Items, and independent Card counters remain independent", async () => {
  const { repo } = await setup(); await mutate(repo, add(item));
  const second: AssessmentSource = { kind: "item", itemId: "practice-speed" };
  await assert.rejects(mutate(repo, add(second, "test-1", 1)), { code: "ASSESSMENT_SOURCE_CONFLICT" });
  await assert.rejects(mutate(repo, edit(second, "test-1", 1)), { code: "ASSESSMENT_SOURCE_CONFLICT" });
  await assert.rejects(mutate(repo, add(second, "new", 0)), AssessmentConflict);
  await mutate(repo, add(second, "new", 1));
  assert.equal((await readAssessmentList(repo, "alice", item)).revision, 2);
  const parallel = await Promise.all([mutate(repo, add()), mutate(repo, add({ kind: "card", cardTemplateId: "fork" }))]);
  assert.deepEqual(parallel.map((result) => result.revision), [1, 1]);
});

test("concurrent ordinary personal writes survive assessment transactions and competing Item Adds fail stale", async () => {
  const { repo } = await setup();
  await Promise.all([mutate(repo, add()), repo.setReflection("alice", "active", "original", "Concurrent reflection"),
    repo.setCompletion("alice", "active", "original", "original-1", "done"),
    repo.setSignalReading("alice", "active", "original", "original-1", 9)]);
  const card = (await repo.getPersonalUser("alice"))!.cardsData[0];
  assert.equal(card.tests.length, 1); assert.equal(card.testsRevision, 1); assert.equal(card.reflection, "Concurrent reflection");
  assert.equal(card.items[0].completionStatus, "done"); assert.equal(card.signalReadings[0].reading, 9);
  const second: AssessmentSource = { kind: "item", itemId: "practice-speed" };
  const outcomes = await Promise.allSettled([mutate(repo, add(item, "one")), mutate(repo, add(second, "two"))]);
  assert.equal(outcomes.filter((outcome) => outcome.status === "fulfilled").length, 1);
  assert.equal((await repo.getPersonalUser("alice"))!.itemTests!.length, 1);
});

test("existing ISO creation timestamps remain readable and unchanged; malformed revisions are explicit", async () => {
  const { repo } = await setup(), createdAt = "2026-10-11T10:00:00.000Z";
  await repo.users().updateOne({ _id: "alice" }, { $set: { "cardsData.0.tests": [{ id: "test-1", date: "2026-10-11", result: true, createdAt }] } } as never);
  assert.equal((await readAssessmentList(repo, "alice", source)).tests[0].createdAt, createdAt);
  await mutate(repo, edit(source, "test-1", 0));
  const raw = await repo.db.collection("users").findOne({ _id: "alice" } as never);
  assert.equal(raw!.cardsData[0].tests[0].createdAt, createdAt);
  await repo.users().updateOne({ _id: "alice" }, { $set: { itemTestsRevision: -1 } });
  await assert.rejects(readAssessmentList(repo, "alice", item), { code: "INVALID_STORED_ASSESSMENT_REVISION" });
});

test("duplicate/corrupt stored assessments and database failures are explicit, never mistaken for empty storage", async () => {
  const { repo } = await setup(); await mutate(repo, add());
  const entry = (await repo.getPersonalUser("alice"))!.cardsData[0].tests[0];
  await repo.users().updateOne({ _id: "alice" }, { $push: { "cardsData.0.tests": entry } });
  await assert.rejects(readAssessmentList(repo, "alice", source), { code: "DUPLICATE_ASSESSMENT_ID_CONFLICT" });
  await assert.rejects(mutate(repo, remove(source, "test-1", 1)), { code: "DUPLICATE_ASSESSMENT_ID_CONFLICT" });
  await repo.users().updateOne({ _id: "alice" }, { $set: { itemTests: null } } as never);
  await assert.rejects(readAssessmentList(repo, "alice", item), { code: "INVALID_STORED_ASSESSMENTS" });
  const failed = new CardRepository(repo.db, client); failed.getPersonalUser = () => { throw new Error("Database unavailable"); };
  await assert.rejects(readAssessmentList(failed, "alice", source), /Database unavailable/);
});

test("failed transactional assessment writes leave list, revision and all other personal data intact", async () => {
  const { repo } = await setup(); const before = await repo.getPersonalUser("alice");
  await repo.db.command({ collMod: "users", validator: { "cardsData.testsRevision": { $exists: false } }, validationLevel: "strict" });
  await assert.rejects(mutate(repo, add())); assert.deepEqual(await repo.getPersonalUser("alice"), before);
  await repo.db.command({ collMod: "users", validator: {} });
  assert.equal((await mutate(repo, add())).revision, 1);
});

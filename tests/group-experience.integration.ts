import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { randomUUID } from "node:crypto";
import { MongoClient } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { groupFixture, completion, signal } from "./helpers/groupExperiences";
import { GroupExperienceRepository } from "../src/lib/groupExperiences/repository";
import { createGroupExperienceIndexes, assertGroupExperienceIndexes } from "../src/lib/groupExperiences/indexes";
import { CardRepository } from "../src/lib/cards/repository";

let mongo: MongoMemoryReplSet, client: MongoClient;
before(async () => { mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } }); client = await new MongoClient(mongo.getUri()).connect(); });
after(async () => { await client?.close(); await mongo?.stop(); });

test("creation pins public versions, assigns metadata once and retries without creating personal rows", async () => {
  const f = await groupFixture(client, { admins: ["bob", "bob"], followers: ["alice", "carol", "carol"] });
  const command = { ...f.command, operationId: "parallel" };
  const results = await Promise.all([f.repo.create("alice", command), f.repo.create("alice", command), f.repo.create("alice", command)]);
  assert.equal(new Set(results.map(result => result.experienceId)).size, 1);
  assert.equal(await f.repo.experiences().countDocuments(), 2);
  const entries = await f.repo.list("carol"); assert.equal(entries.entries.length, 2); assert.ok(entries.entries.every(row => row.isFollower && !row.isAdmin));
  assert.equal((await f.repo.list("alice")).entries[0].isAdmin, true);
  const bob = (await f.repo.list("bob")).entries[0]; assert.equal(bob.isFollower, false); assert.equal(bob.isAdmin, true);
  for (const user of ["alice", "bob", "carol"]) {
    const stored = (await f.cards.getPersonalUser(user))!; assert.deepEqual(stored.cardsData, []); assert.deepEqual(stored.decksData, []);
  }
  assert.equal((await f.repo.members().findOne({ experienceId: f.experienceId, userId: "carol" }))!.retainedCardAssignments.length, 2);
  await assert.rejects(f.repo.create("alice", { ...command, name: "Different intent" }), { code: "GROUP_OPERATION_CONFLICT" });
  await assert.rejects(f.repo.create("alice", { ...f.command, operationId: "unknown", followerIds: ["missing"] }), { code: "GROUP_USER_UNAVAILABLE" });
});
test("public roots never authorize private or unclassified historical versions even for the template owner", async () => {
  const f = await groupFixture(client);
  await f.cards.cardVersions().updateOne({ cardTemplateId: f.ids[0], version: 1 }, { $set: { visibility: "private" } });
  await assert.rejects(f.repo.create("creator", { ...f.command, operationId: "private" }), { code: "CARD_VERSION_FORBIDDEN" });
  await assert.rejects(f.repo.get("alice", f.experienceId), { code: "CARD_VERSION_FORBIDDEN" });
  await f.cards.cardVersions().updateOne({ cardTemplateId: f.ids[0], version: 1 }, { $set: { visibility: "public" } });
  await f.cards.deckVersions().updateOne({ deckTemplateId: f.deckId, version: 1 }, { $unset: { visibility: "" } });
  await assert.rejects(f.repo.create("creator", { ...f.command, operationId: "unclassified" }), { code: "DECK_VERSION_FORBIDDEN" });
});
test("stale preview, mismatched composition and unpublished/private roots cannot create an experience", async () => {
  const f = await groupFixture(client);
  await assert.rejects(f.repo.create("alice", { ...f.command, operationId: "missing-card", manifest: { ...f.command.manifest, cards: [] } }), { code: "GROUP_PREVIEW_CONFLICT" });
  await f.cards.cards().updateOne({ cardTemplateId: f.ids[0] }, { $set: { latestVersion: 2 } });
  await assert.rejects(f.repo.create("alice", { ...f.command, operationId: "stale" }), { code: "GROUP_PREVIEW_CONFLICT" });
  await f.cards.cards().updateOne({ cardTemplateId: f.ids[0] }, { $set: { latestVersion: 0, visibility: "private" } });
  await assert.rejects(f.repo.create("creator", { ...f.command, operationId: "private-root" }), { code: "CARD_VERSION_FORBIDDEN" });
});
test("roles isolate admin, follower, creator, application admin and other experiences", async () => {
  const f = await groupFixture(client);
  await assert.rejects(f.repo.card("alice", f.experienceId, f.ids[0], "self"), { code: "GROUP_FORBIDDEN" });
  await assert.rejects(f.repo.writeLearning("alice", f.experienceId, f.ids[0], "personal", completion("a0")), { code: "GROUP_FORBIDDEN" });
  await assert.rejects(f.repo.writeLearning("bob", f.experienceId, f.ids[0], "group", completion("a0")), { code: "GROUP_FORBIDDEN" });
  await assert.rejects(f.repo.card("bob", f.experienceId, f.ids[0], "follower", "carol"), { code: "GROUP_PERSPECTIVE_FORBIDDEN" });
  for (const actor of ["creator", "outsider"]) {
    await assert.rejects(f.repo.get(actor, f.experienceId), { code: "GROUP_FORBIDDEN" });
    await assert.rejects(f.repo.summary(actor, f.experienceId), { code: "GROUP_FORBIDDEN" });
  }
  const other = await f.repo.create("dave", { ...f.command, operationId: "other", followerIds: [] });
  await assert.rejects(f.repo.card("alice", other.experienceId, f.ids[0], "group"), { code: "GROUP_FORBIDDEN" });
  await assert.rejects(f.repo.roster("bob", f.experienceId), { code: "GROUP_FORBIDDEN" });
  assert.equal((await f.repo.card("bob", f.experienceId, f.ids[0], "group")).capabilities.canWriteLearning, false);
});
test("admin inspection and aggregates use only allowlisted database projections and never initialize a subject", async t => {
  const f = await groupFixture(client); await f.cards.ensureCardData("bob", f.ids[0], 1);
  await f.cards.users().updateOne({ _id: "bob" }, { $set: {
    "cardsData.0.reflection": "PRIVATE-reflection", "cardsData.0.mediaItems": [{ src: "PRIVATE-url" }], "cardsData.0.tests": [{ id: "PRIVATE-test" }],
    "cardsData.0.personalInfoCardIds": ["PRIVATE-info"], "cardsData.0.targetDate": "2099-12-31", "cardsData.0.chats": [{ id: "PRIVATE-history" }],
  } });
  t.mock.method(f.cards, "getPersonalUser", () => { throw Error("Full personal read is forbidden"); });
  const view = await f.repo.card("alice", f.experienceId, f.ids[0], "follower", "bob");
  const all = [view, await f.repo.summary("alice", f.experienceId), await f.repo.perspectives("alice", f.experienceId, f.ids[0]), await f.repo.roster("alice", f.experienceId)];
  assert.ok(!JSON.stringify(all).includes("PRIVATE")); assert.ok(!JSON.stringify(all).includes("2099-12-31"));
  assert.deepEqual(Object.keys(view.learning).sort(), ["cardTemplateId", "items", "signalReadings", "version"]);
  assert.equal(view.capabilities.canWriteLearning, false);
  assert.deepEqual((await f.cards.users().findOne({ _id: "carol" }))!.cardsData, []);
  await f.repo.open("alice", f.experienceId, 0, f.ids[0]);
  assert.deepEqual((await f.cards.users().findOne({ _id: "alice" }))!.cardsData, []);
});
test("own writes share personal authority across groups and preserve private fields, adoption and scheduling", async () => {
  const f = await groupFixture(client); await f.cards.ensureCardData("bob", f.ids[0], 1);
  await f.cards.users().updateOne({ _id: "bob" }, { $set: { "cardsData.0.reflection": "private", "cardsData.0.personalInfoCardIds": ["private"],
    "cardsData.0.tests": [{ id: "private" }], "cardsData.0.targetDate": "2028-04-05" } });
  const before = (await f.cards.getPersonalUser("bob"))!.cardsData[0];
  const other = await f.repo.create("alice", { ...f.command, operationId: "another" });
  await Promise.all([
    f.repo.writeLearning("bob", f.experienceId, f.ids[0], "personal", completion("a0")),
    f.repo.writeLearning("bob", other.experienceId, f.ids[0], "personal", signal("b0", 7.25)),
  ]);
  const after = (await f.cards.getPersonalUser("bob"))!.cardsData[0];
  assert.deepEqual({ ...after, items: before.items, signalReadings: before.signalReadings, updatedAt: before.updatedAt }, before);
  assert.equal((await f.repo.card("bob", other.experienceId, f.ids[0], "self")).learning.items[0].completionStatus, "done");
  assert.equal((await f.repo.card("alice", f.experienceId, f.ids[0], "group")).learning.items[0].completionStatus, "todo");
  await assert.rejects(f.cards.setCompletion("bob", f.deckId, f.ids[0], "a0", "todo"));
  await Promise.all([f.repo.open("carol", f.experienceId, 0, f.ids[0]), f.repo.writeLearning("carol", other.experienceId, f.ids[0], "personal", signal("a0", 4))]);
  const stored = (await f.cards.getPersonalUser("carol"))!; assert.equal(stored.cardsData.length, 1); assert.equal(stored.cardsData[0].targetDate, null);
  assert.deepEqual(stored.decksData, []);
});
test("independent admin group writes preserve both fields and never modify personal learning", async () => {
  const f = await groupFixture(client, { admins: ["bob"] });
  await Promise.all([f.repo.writeLearning("alice", f.experienceId, f.ids[0], "group", completion("a0")),
    f.repo.writeLearning("bob", f.experienceId, f.ids[0], "group", signal("b0", 8))]);
  const view = await f.repo.card("carol", f.experienceId, f.ids[0], "group");
  assert.equal(view.learning.items[0].completionStatus, "done"); assert.equal(view.learning.signalReadings[1].reading, 8);
  for (const actor of ["alice", "bob", "carol"]) assert.deepEqual((await f.cards.getPersonalUser(actor))!.cardsData, []);
  assert.equal(await f.repo.cardData().countDocuments({ experienceId: f.experienceId, cardTemplateId: f.ids[0] }), 1);
});
test("active followers including an explicit dual-role admin count once and confidence is raw weighted", async () => {
  const f = await groupFixture(client, { followers: ["alice", "bob", "carol", "dave"], cardCount: 1 });
  await f.repo.writeLearning("alice", f.experienceId, f.ids[0], "personal", signal("a0", 10));
  for (const actor of ["bob", "carol", "dave"]) await f.repo.writeLearning(actor, f.experienceId, f.ids[0], "personal", signal("a0", 2));
  for (const step of ["a0", "b0", "c0"]) await f.repo.writeLearning("bob", f.experienceId, f.ids[0], "personal", completion(step, "skipped"));
  const summary = await f.repo.summary("alice", f.experienceId);
  assert.deepEqual(summary.followers, { activeTotal: 4, eligibleTotal: 3, doing: 0, done: 0, confidence: 4 });
  assert.deepEqual(summary.group, { completion: 0, confidence: null });
  assert.equal(summary.cards[0].steps[0].followers.done, 0);
  assert.equal(summary.cards[0].steps[0].followers.eligibleTotal, 3);
});
test("zero followers and empty Deck retain null/empty semantics", async () => {
  const f = await groupFixture(client, { followers: [], cardCount: 0 });
  const summary = await f.repo.summary("alice", f.experienceId);
  assert.deepEqual(summary.group, { completion: null, confidence: null });
  assert.deepEqual(summary.followers, { activeTotal: 0, eligibleTotal: 0, doing: 0, done: 0, confidence: null });
  assert.deepEqual(summary.cards, []); assert.equal((await f.repo.open("alice", f.experienceId, 0)).activeCardId, null);
});
test("member commands are idempotent, paginated and bound to current roles and structural revision", async () => {
  const f = await groupFixture(client);
  const command = { operationId: "add", kind: "add-follower", targetUserId: "dave", expectedStructureRevision: 0 };
  await Promise.all([f.repo.changeMember("alice", f.experienceId, command), f.repo.changeMember("alice", f.experienceId, command)]);
  assert.equal(await f.repo.members().countDocuments({ experienceId: f.experienceId, userId: "dave" }), 1);
  const first = await f.repo.roster("alice", f.experienceId, undefined, 2), second = await f.repo.roster("alice", f.experienceId, first.nextCursor!, 2);
  assert.equal(new Set([...first.members, ...second.members].map(member => member.userId)).size, 4);
  await assert.rejects(f.repo.changeMember("bob", f.experienceId, command), { code: "GROUP_FORBIDDEN" });
  await assert.rejects(f.repo.changeMember("alice", f.experienceId, { ...command, targetUserId: "carol" }), { code: "GROUP_OPERATION_CONFLICT" });
  await f.repo.changeMember("alice", f.experienceId, { operationId: "promote", kind: "set-admin", isAdmin: true, targetUserId: "bob", expectedStructureRevision: 1 });
  assert.equal((await f.repo.changeMember("alice", f.experienceId, command)).outcome, "superseded");
  await assert.rejects(f.repo.writeLearning("bob", f.experienceId, f.ids[0], "personal", completion("a0")), { code: "GROUP_ACCESS_CONFLICT" });
  await f.repo.writeLearning("bob", f.experienceId, f.ids[0], "group", completion("a0", "done", 1));
});
test("two admins concurrently relinquishing or removing one another cannot remove the final admin", async () => {
  for (const self of [true, false]) {
    const f = await groupFixture(client, { admins: ["bob"] });
    const results = await Promise.allSettled(["alice", "bob"].map(actor => f.repo.changeMember(actor, f.experienceId,
      { operationId: randomUUID(), kind: "set-admin", isAdmin: false, targetUserId: self ? actor : actor === "alice" ? "bob" : "alice", expectedStructureRevision: 0 })));
    assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
    const admins = await f.repo.members().find({ experienceId: f.experienceId, isAdmin: true }).toArray();
    assert.equal(admins.length, 1); assert.equal((await f.repo.experiences().findOne({ experienceId: f.experienceId }))!.adminCount, 1);
    await assert.rejects(f.repo.changeMember(admins[0].userId, f.experienceId,
      { operationId: "last", kind: "set-admin", isAdmin: false, targetUserId: admins[0].userId, expectedStructureRevision: 1 }), { code: "GROUP_FINAL_ADMIN_CONFLICT" });
  }
});
test("duplicate, malformed and missing ordinary personal rows fail without fabricated defaults or repair", async () => {
  const f = await groupFixture(client); await f.cards.ensureDeckData("bob", f.deckId, 1);
  await f.cards.users().updateOne({ _id: "bob" }, { $set: { cardsData: [] } });
  await assert.rejects(f.repo.card("alice", f.experienceId, f.ids[0], "follower", "bob"), { code: "MISSING_CARD_DATA" });
  await assert.rejects(f.repo.writeLearning("bob", f.experienceId, f.ids[0], "personal", completion("a0")), { code: "MISSING_CARD_DATA" });
  await f.cards.ensureCardData("carol", f.ids[0], 1); const card = (await f.cards.getPersonalUser("carol"))!.cardsData[0];
  await f.cards.users().updateOne({ _id: "carol" }, { $push: { cardsData: card } });
  await assert.rejects(f.repo.card("alice", f.experienceId, f.ids[0], "follower", "carol"), { code: "AMBIGUOUS_CARD_DATA" });
  await f.cards.users().updateOne({ _id: "carol" }, { $set: { cardsData: [{ ...card, signalReadings: [{ stepId: "a0", reading: NaN }] }] } });
  await assert.rejects(f.repo.card("alice", f.experienceId, f.ids[0], "follower", "carol"), { code: "INVALID_SIGNAL_READING" });
  await assert.rejects(f.repo.writeLearning("carol", f.experienceId, f.ids[0], "personal", completion("unknown")), { code: "STEP_OUTSIDE_ADOPTED_CARD" });
});
test("index provisioning is explicit, repeatable and required before group writes", async () => {
  const db = client.db(`switchplay_test_no_indexes_${randomUUID()}`), repo = new GroupExperienceRepository(new CardRepository(db, client));
  await assert.rejects(repo.list("alice"), { code: "GROUP_INDEXES_NOT_READY" });
  await createGroupExperienceIndexes(db); await createGroupExperienceIndexes(db); await assertGroupExperienceIndexes(db);
  await db.collection("groupExperienceMembers").dropIndex("group_member_identity");
  await assert.rejects(assertGroupExperienceIndexes(db), { code: "GROUP_INDEXES_NOT_READY" });
});

import assert from "node:assert/strict";
import { before, after, test, type TestContext } from "node:test";
import { MongoClient } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { groupFixture, completion, signal, publishGroupCard, publishGroupDeck, reviewedUpdate } from "./helpers/groupExperiences";
import { GroupExperienceRepository } from "../src/lib/groupExperiences/repository";
import { createDefaultCardContent } from "../src/lib/cards/creatorDefaults";

let mongo: MongoMemoryReplSet, client: MongoClient;
before(async () => { mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } }); client = await new MongoClient(mongo.getUri()).connect(); });
after(async () => { await client?.close(); await mongo?.stop(); });
const member = (kind: "remove-follower" | "add-follower", expectedStructureRevision: number, operationId: string = kind, targetUserId = "bob") =>
  ({ kind, expectedStructureRevision, operationId, targetUserId });
test("all-skipped historical learning has no eligible completion and retains independent confidence", async () => {
  const f = await groupFixture(client, { cardCount: 1 });
  for (const step of ["a0", "b0", "c0"]) await f.repo.writeLearning("bob", f.experienceId, f.ids[0], "personal", completion(step, "skipped"));
  await f.repo.writeLearning("bob", f.experienceId, f.ids[0], "personal", signal("a0", 8));
  await f.repo.changeMember("alice", f.experienceId, member("remove-follower", 0));
  const snapshot = await f.repo.snapshot("alice", f.experienceId, "bob");
  assert.deepEqual(snapshot.metrics, { completion: null, confidence: 8 });
  assert.ok(snapshot.learning[0].items.every(item => item.completionStatus === "skipped"));
});
function gateBeforeFence(t: TestContext, repo: GroupExperienceRepository) {
  let release!: () => void, reached!: () => void, once = true, calls = 0;
  const held = new Promise<void>(resolve => { release = resolve; }), ready = new Promise<void>(resolve => { reached = resolve; });
  const original = repo.fence.bind(repo);
  t.mock.method(repo, "fence", async (...args: Parameters<typeof repo.fence>) => { calls++; if (once) { once = false; reached(); await held; } return original(...args); });
  t.after(release); return { ready, release, calls: () => calls };
}
test("group adoption is independent, reviewed, private-safe and never fans out personal state", async t => {
  const f = await groupFixture(client); await f.cards.ensureDeckData("bob", f.deckId, 1);
  await f.cards.setCompletion("bob", f.deckId, f.ids[0], "c0", "done");
  await f.cards.users().updateOne({ _id: "bob" }, { $set: { "cardsData.0.reflection": "PRIVATE", "cardsData.0.tests": [{ id: "PRIVATE" }] } });
  const other = await f.repo.create("alice", { ...f.command, operationId: "other" });
  const before = await f.cards.users().find({}).toArray();
  await publishGroupCard(f, 0, ["a0", "b0", "d0"]);
  const reviewed = await reviewedUpdate(f, "card", f.ids[0]);
  assert.equal(reviewed.review.sourceVersion, 1); assert.equal(reviewed.review.targetVersion, 2);
  const users = f.cards.users(); t.mock.method(users, "updateOne", () => { throw Error("Adoption must not write users"); }); t.mock.method(f.cards, "users", () => users);
  await f.repo.adoptUpdate("alice", f.experienceId, reviewed);
  assert.deepEqual(await f.cards.users().find({}).toArray(), before);
  assert.equal((await f.repo.get("bob", f.experienceId)).cards[0].version, 2);
  assert.equal((await f.repo.get("bob", other.experienceId)).cards[0].version, 1);
  assert.equal((await f.cards.getPersonalUser("bob"))!.cardsData[0].cardTemplateVersion, 1);
  assert.equal((await f.repo.adoptUpdate("alice", f.experienceId, reviewed)).outcome, "already-adopted");
  await assert.rejects(f.repo.adoptUpdate("bob", f.experienceId, reviewed), { code: "GROUP_UPDATE_SESSION_CONFLICT" });
});
test("new publication invalidates a review; chronological public notes and exact retry outcomes remain coherent", async () => {
  const f = await groupFixture(client); await publishGroupCard(f, 0, ["b0", "a0", "c0"]);
  const stale = await reviewedUpdate(f, "card", f.ids[0]); await publishGroupCard(f, 0, ["a0", "b0", "d0"]);
  await assert.rejects(f.repo.adoptUpdate("alice", f.experienceId, stale), { code: "GROUP_UPDATE_CONFLICT" });
  const latest = await f.repo.reviewUpdate("alice", f.experienceId, "card", f.ids[0]);
  assert.deepEqual(latest.review!.notes.map(note => note.version), [2, 3]);
  const command = { operationId: "latest", review: latest.review!.command }; await f.repo.adoptUpdate("alice", f.experienceId, command);
  await f.repo.changeMember("alice", f.experienceId, member("add-follower", 1, "add-dave", "dave"));
  assert.equal((await f.repo.adoptUpdate("alice", f.experienceId, command)).outcome, "superseded");
  await assert.rejects(f.repo.adoptUpdate("alice", f.experienceId, { ...command, review: { ...command.review, targetVersion: 4 } }), { code: "GROUP_OPERATION_CONFLICT" });
});
test("stale writes use public stable Step intersection, retaining obsolete values and rejecting removed or newly substituted Steps", async () => {
  const f = await groupFixture(client);
  await f.repo.writeLearning("bob", f.experienceId, f.ids[0], "personal", completion("c0"));
  await publishGroupCard(f, 0, ["b0", "a0", "c0"]); await f.repo.adoptUpdate("alice", f.experienceId, await reviewedUpdate(f, "card", f.ids[0]));
  await publishGroupCard(f, 0, ["a0", "b0", "d0"]); await f.repo.adoptUpdate("alice", f.experienceId, await reviewedUpdate(f, "card", f.ids[0]));
  await f.repo.writeLearning("bob", f.experienceId, f.ids[0], "personal", signal("a0", 7, 0, 1));
  await assert.rejects(f.repo.writeLearning("bob", f.experienceId, f.ids[0], "personal", completion("c0", "done", 0, 1)), { code: "STEP_OUTSIDE_ADOPTED_CARD" });
  await assert.rejects(f.repo.writeLearning("bob", f.experienceId, f.ids[0], "personal", completion("d0", "done", 0, 1)), { code: "STEP_OUTSIDE_ADOPTED_CARD" });
  await assert.rejects(f.repo.writeLearning("bob", f.experienceId, f.ids[0], "personal", completion("a0", "done", 0, 4)), { code: "GROUP_VERSION_CONFLICT" });
  await f.repo.writeLearning("bob", f.experienceId, f.ids[0], "personal", completion("d0", "done", 0, 3));
  await publishGroupCard(f, 0, ["c0", "a0", "b0"]); await f.repo.adoptUpdate("alice", f.experienceId, await reviewedUpdate(f, "card", f.ids[0]));
  const view = await f.repo.card("bob", f.experienceId, f.ids[0], "self"); assert.equal(view.learning.items[0].completionStatus, "done");
  const stored = (await f.cards.getPersonalUser("bob"))!.cardsData[0]; assert.equal(stored.items.find(item => item.stepId === "d0")!.completionStatus, "done"); assert.equal(stored.cardTemplateVersion, 1);
  await f.cards.cardVersions().updateOne({ cardTemplateId: f.ids[0], version: 1 }, { $set: { visibility: "private" } });
  await assert.rejects(f.repo.writeLearning("bob", f.experienceId, f.ids[0], "personal", signal("a0", 8, 0, 1)), { code: "CARD_VERSION_FORBIDDEN" });
});
test("Deck removal retains eligible versions and reintroduction reuses group selections without adopting a newer publication", async () => {
  const f = await groupFixture(client); await f.repo.writeLearning("bob", f.experienceId, f.ids[0], "personal", completion("a0"));
  await publishGroupCard(f, 0, ["a0", "b0", "d0"]); await f.repo.adoptUpdate("alice", f.experienceId, await reviewedUpdate(f, "card", f.ids[0]));
  const before = (await f.cards.getPersonalUser("bob"))!;
  await publishGroupDeck(f, []); await f.repo.adoptUpdate("alice", f.experienceId, await reviewedUpdate(f, "deck", f.deckId));
  assert.deepEqual((await f.repo.get("bob", f.experienceId)).cards, []);
  assert.deepEqual(await f.cards.getPersonalUser("bob"), before);
  assert.equal((await f.repo.members().findOne({ experienceId: f.experienceId, userId: "bob" }))!.retainedCardAssignments.find(ref => ref.cardTemplateId === f.ids[0])!.version, 2);
  await assert.rejects(f.repo.writeLearning("bob", f.experienceId, f.ids[0], "personal", completion("a0")), { code: "GROUP_CARD_FORBIDDEN" });
  await publishGroupCard(f, 0, ["a0", "b0", "e0"]); await publishGroupDeck(f, [f.ids[0]]);
  const review = await reviewedUpdate(f, "deck", f.deckId); assert.equal(review.review.cards[0].version, 2);
  await f.repo.adoptUpdate("alice", f.experienceId, review);
  assert.equal((await f.repo.card("bob", f.experienceId, f.ids[0], "self")).learning.items[0].completionStatus, "done");
});
test("removal freezes only permitted learning, revokes fresh access and preserves personal data and contributions", async t => {
  const f = await groupFixture(client); await f.cards.ensureDeckData("bob", f.deckId, 1);
  await f.repo.writeLearning("bob", f.experienceId, f.ids[0], "personal", completion("a0"));
  await f.cards.users().updateOne({ _id: "bob" }, { $set: { "cardsData.0.reflection": "PRIVATE", "cardsData.0.tests": [{ id: "PRIVATE" }],
    "cardsData.0.mediaItems": [{ src: "PRIVATE" }], "cardsData.0.personalInfoCardIds": ["PRIVATE"], "cardsData.0.chats": [{ id: "PRIVATE" }], "cardsData.0.targetDate": "2099-12-31" } });
  const contributions = f.cards.db.collection("groupMediaContributions"); await contributions.insertOne({ experienceId: f.experienceId, authorUserId: "bob", content: "group contribution" });
  const before = await f.cards.getPersonalUser("bob");
  await f.repo.changeMember("alice", f.experienceId, member("remove-follower", 0));
  assert.deepEqual(await f.cards.getPersonalUser("bob"), before); assert.equal(await contributions.countDocuments(), 1);
  const snapshot = await f.repo.snapshot("alice", f.experienceId, "bob");
  assert.ok(!JSON.stringify(snapshot).includes("PRIVATE")); assert.ok(!JSON.stringify(snapshot).includes("2099-12-31"));
  const rows = await f.repo.removals().find({}).toArray(); assert.ok(!JSON.stringify(rows).includes("PRIVATE"));
  assert.deepEqual(Object.keys(rows[0]).sort(), ["_id", "cardTemplateId", "experienceId", "generation", "items", "signalReadings", "snapshotAt", "userId", "version"]);
  await assert.rejects(f.repo.get("bob", f.experienceId), { code: "GROUP_FORBIDDEN" });
  await assert.rejects(f.repo.writeLearning("bob", f.experienceId, f.ids[0], "personal", completion("a0")), { code: "GROUP_FORBIDDEN" });
  assert.equal((await f.repo.list("bob")).entries.length, 0); assert.equal((await f.repo.summary("alice", f.experienceId)).followers.activeTotal, 1);
  await f.cards.setCompletion("bob", f.deckId, f.ids[0], "a0", "todo"); await f.cards.setReflection("bob", f.deckId, f.ids[0], "Later private reflection");
  t.mock.method(f.cards, "getPersonalUser", () => { throw Error("Former inspection must not read live personal state"); });
  assert.deepEqual(await f.repo.snapshot("alice", f.experienceId, "bob"), snapshot);
  const view = await f.repo.card("alice", f.experienceId, f.ids[0], "follower", "bob"); assert.equal(view.learning.items[0].completionStatus, "done");
  assert.equal((await f.repo.changeMember("alice", f.experienceId, member("remove-follower", 0))).outcome, "already-applied");
});
test("former views distinguish new Steps and Cards from unavailable history; rejoin uses live learning and replaces only the latest removal generation", async () => {
  const f = await groupFixture(client); await f.cards.ensureDeckData("bob", f.deckId, 1); await f.cards.setCompletion("bob", f.deckId, f.ids[0], "c0", "done");
  const remove = member("remove-follower", 0); await f.repo.changeMember("alice", f.experienceId, remove);
  const first = await f.repo.snapshot("alice", f.experienceId, "bob");
  await publishGroupCard(f, 0, ["a0", "b0", "d0"]); await f.repo.adoptUpdate("alice", f.experienceId, await reviewedUpdate(f, "card", f.ids[0]));
  const frozen = (await f.repo.card("alice", f.experienceId, f.ids[0], "follower", "bob")).learning;
  assert.equal(frozen.items[2].completionStatus, null); assert.equal("available" in frozen.items[2] && frozen.items[2].available, false);
  assert.equal((await f.repo.members().findOne({ experienceId: f.experienceId, userId: "bob" }))!.retainedCardAssignments.find(ref => ref.cardTemplateId === f.ids[0])!.version, 1);
  const extra = await f.cards.createCardDraft("creator", { ...createDefaultCardContent(["new-a", "new-b", "new-c"]), intro: { title: "New", description: null, mediaItem: null } }, "public");
  await f.cards.publishCard("creator", extra.cardTemplateId, 0); await publishGroupDeck(f, [...f.ids, extra.cardTemplateId]);
  await f.repo.adoptUpdate("alice", f.experienceId, await reviewedUpdate(f, "deck", f.deckId));
  const missing = (await f.repo.card("alice", f.experienceId, extra.cardTemplateId, "follower", "bob")).learning;
  assert.ok(missing.items.every(item => "available" in item && !item.available));
  await f.cards.setCompletion("bob", f.deckId, f.ids[0], "a0", "done");
  const before = await f.cards.getPersonalUser("bob");
  await f.repo.changeMember("alice", f.experienceId, member("add-follower", 3)); assert.deepEqual(await f.cards.getPersonalUser("bob"), before);
  assert.equal((await f.repo.card("bob", f.experienceId, f.ids[0], "self")).learning.items[0].completionStatus, "done");
  assert.equal((await f.repo.changeMember("alice", f.experienceId, remove)).outcome, "superseded");
  await assert.rejects(f.repo.snapshot("alice", f.experienceId, "bob"), { code: "GROUP_SNAPSHOT_FORBIDDEN" });
  await assert.rejects(f.repo.writeLearning("bob", f.experienceId, f.ids[0], "personal", completion("a0", "todo", 0, 2)), { code: "GROUP_ACCESS_CONFLICT" });
  await f.repo.changeMember("alice", f.experienceId, member("remove-follower", 4, "remove-again"));
  const second = await f.repo.snapshot("alice", f.experienceId, "bob"); assert.notEqual(second.manifest.generation, first.manifest.generation);
  assert.equal(await f.repo.removals().countDocuments({ experienceId: f.experienceId, userId: "bob" }), 3);
});
test("follower removal retains independent admin grants until the admin role is also removed", async () => {
  const f = await groupFixture(client, { admins: ["bob"] });
  await f.repo.changeMember("alice", f.experienceId, member("remove-follower", 0));
  assert.equal((await f.repo.get("bob", f.experienceId)).isAdmin, true); assert.equal((await f.repo.summary("bob", f.experienceId)).followers.activeTotal, 1);
  await f.repo.writeLearning("bob", f.experienceId, f.ids[0], "group", completion("a0", "done", 1));
  await assert.rejects(f.repo.writeLearning("bob", f.experienceId, f.ids[0], "personal", completion("a0", "done", 1)), { code: "GROUP_FORBIDDEN" });
  await f.repo.changeMember("alice", f.experienceId, { kind: "set-admin", isAdmin: false, targetUserId: "bob", operationId: "demote", expectedStructureRevision: 1 });
  await assert.rejects(f.repo.get("bob", f.experienceId), { code: "GROUP_FORBIDDEN" });
});
test("removal rollback preserves access and does not leave a partial snapshot or receipt", async t => {
  const f = await groupFixture(client), collection = f.repo.removals();
  t.mock.method(collection, "insertMany", () => { throw Error("Injected snapshot failure"); }); t.mock.method(f.repo, "removals", () => collection);
  await assert.rejects(f.repo.changeMember("alice", f.experienceId, member("remove-follower", 0)), /Injected/);
  assert.equal((await f.repo.get("bob", f.experienceId)).isFollower, true); assert.equal(await collection.countDocuments(), 0); assert.equal(await f.repo.receipts().countDocuments(), 0);
});
test("deterministic removal versus group personal write covers both orderings without post-removal commits", async t => {
  for (const removalFirst of [true, false]) {
    const f = await groupFixture(client), competing = new GroupExperienceRepository(f.cards), gate = gateBeforeFence(t, f.repo);
    const held = removalFirst ? f.repo.writeLearning("bob", f.experienceId, f.ids[0], "personal", completion("a0"))
      : f.repo.changeMember("alice", f.experienceId, member("remove-follower", 0));
    const observed = held.then(value => ({ value, error: null }), error => ({ value: null, error }));
    await gate.ready;
    if (removalFirst) await competing.changeMember("alice", f.experienceId, member("remove-follower", 0));
    else await competing.writeLearning("bob", f.experienceId, f.ids[0], "personal", completion("a0"));
    gate.release(); const result = await observed;
    if (removalFirst) assert.equal(result.error.code, "GROUP_FORBIDDEN"); else assert.equal(result.error, null);
    const snapshot = await f.repo.snapshot("alice", f.experienceId, "bob"); assert.equal(snapshot.learning[0].items[0].completionStatus, removalFirst ? "todo" : "done");
  }
});
test("deterministic adoption versus member addition either rejects stale intent or assigns the new manifest on retry", async t => {
  for (const adoptionFirst of [true, false]) {
    const f = await groupFixture(client, { admins: ["carol"] }), competing = new GroupExperienceRepository(f.cards);
    await publishGroupDeck(f, [f.ids[1]]); const update = await reviewedUpdate(f, "deck", f.deckId, "carol"), add = member("add-follower", 0, "add", "dave");
    const gate = gateBeforeFence(t, f.repo);
    const held = adoptionFirst ? f.repo.changeMember("alice", f.experienceId, add) : f.repo.adoptUpdate("carol", f.experienceId, update);
    const observed = held.then(() => null, error => error); await gate.ready;
    if (adoptionFirst) await competing.adoptUpdate("carol", f.experienceId, update); else await competing.changeMember("alice", f.experienceId, add);
    gate.release(); assert.ok(await observed);
    if (adoptionFirst) await f.repo.changeMember("alice", f.experienceId, { ...add, expectedStructureRevision: 1 });
    else await f.repo.adoptUpdate("carol", f.experienceId, await reviewedUpdate(f, "deck", f.deckId, "carol"));
    const assigned = (await f.repo.get("dave", f.experienceId)).cards; assert.deepEqual(assigned.map(card => card.cardTemplateId), [f.ids[1]]);
    const refs = (await f.repo.members().findOne({ experienceId: f.experienceId, userId: "dave" }))!.retainedCardAssignments;
    assert.equal(refs.some(ref => ref.cardTemplateId === f.ids[0]), !adoptionFirst);
  }
});
test("deterministic remove versus rejoin preserves the winning transition and exact old retries never undo it", async t => {
  for (const rejoinFirst of [true, false]) {
    const f = await groupFixture(client), competing = new GroupExperienceRepository(f.cards);
    await f.repo.changeMember("alice", f.experienceId, member("remove-follower", 0, "initial"));
    const gate = gateBeforeFence(t, f.repo), remove = member("remove-follower", 1, "remove-again"), rejoin = member("add-follower", 1, "rejoin");
    const held = rejoinFirst ? f.repo.changeMember("alice", f.experienceId, remove) : f.repo.changeMember("alice", f.experienceId, rejoin);
    const observed = held.then(() => null, error => error); await gate.ready;
    await competing.changeMember("alice", f.experienceId, rejoinFirst ? rejoin : remove); gate.release();
    assert.equal((await observed).code, "GROUP_STRUCTURE_CONFLICT");
    assert.equal((await f.repo.members().findOne({ experienceId: f.experienceId, userId: "bob" }))!.followerStatus, rejoinFirst ? "active" : "removed");
    assert.equal((await f.repo.changeMember("alice", f.experienceId, member("remove-follower", 0, "initial"))).outcome, "superseded");
  }
});
test("deterministic competing admin removals revoke a losing actor before its command can commit", async t => {
  const f = await groupFixture(client, { admins: ["bob"] }), competing = new GroupExperienceRepository(f.cards), gate = gateBeforeFence(t, f.repo);
  const held = f.repo.changeMember("alice", f.experienceId, { kind: "set-admin", isAdmin: false, targetUserId: "bob", operationId: "a", expectedStructureRevision: 0 });
  const observed = held.then(() => null, error => error); await gate.ready;
  await competing.changeMember("bob", f.experienceId, { kind: "set-admin", isAdmin: false, targetUserId: "alice", operationId: "b", expectedStructureRevision: 0 });
  gate.release(); assert.equal((await observed).code, "GROUP_FORBIDDEN");
  assert.equal(await f.repo.members().countDocuments({ experienceId: f.experienceId, isAdmin: true }), 1);
});
test("deterministic adoption versus follower Step write preserves earlier values and rejects newly unauthorized removed Steps", async t => {
  for (const adoptionFirst of [true, false]) {
    const f = await groupFixture(client), competing = new GroupExperienceRepository(f.cards);
    await publishGroupCard(f, 0, ["a0", "b0", "d0"]); const update = await reviewedUpdate(f, "card", f.ids[0]);
    const gate = gateBeforeFence(t, f.repo);
    const held = adoptionFirst ? f.repo.writeLearning("bob", f.experienceId, f.ids[0], "personal", completion("c0")) : f.repo.adoptUpdate("alice", f.experienceId, update);
    const observed = held.then(() => null, error => error); await gate.ready;
    if (adoptionFirst) await competing.adoptUpdate("alice", f.experienceId, update);
    else await competing.writeLearning("bob", f.experienceId, f.ids[0], "personal", completion("c0"));
    gate.release(); const error = await observed;
    if (adoptionFirst) assert.equal(error.code, "STEP_OUTSIDE_ADOPTED_CARD"); else assert.equal(error, null);
    const stored = (await f.cards.getPersonalUser("bob"))!.cardsData;
    assert.equal(stored[0]?.items.find(item => item.stepId === "c0")?.completionStatus, adoptionFirst ? undefined : "done");
    assert.equal((await f.repo.get("alice", f.experienceId)).cards[0].version, 2);
  }
});
test("a group write already authorized on an old version may commute with another admin adoption and remain historical", async t => {
  const f = await groupFixture(client, { admins: ["bob"], followers: [] }), competing = new GroupExperienceRepository(f.cards);
  await publishGroupCard(f, 0, ["a0", "b0", "d0"]); const update = await reviewedUpdate(f, "card", f.ids[0], "bob");
  const collection = f.repo.states(), find = collection.findOne.bind(collection);
  let release!: () => void, reached!: () => void, once = true;
  const ready = new Promise<void>(resolve => { reached = resolve; }), held = new Promise<void>(resolve => { release = resolve; }); t.after(release);
  t.mock.method(collection, "findOne", async (...args: Parameters<typeof find>) => { const row = await find(...args); if (once) { once = false; reached(); await held; } return row; });
  t.mock.method(f.repo, "states", () => collection);
  const write = f.repo.writeLearning("alice", f.experienceId, f.ids[0], "group", completion("c0"));
  await ready; await competing.adoptUpdate("bob", f.experienceId, update); release(); await write;
  assert.equal((await collection.findOne({ experienceId: f.experienceId, cardTemplateId: f.ids[0] }))!.items[0].stepId, "c0");
  assert.equal((await f.repo.card("alice", f.experienceId, f.ids[0], "group")).learning.items.some(item => item.stepId === "c0"), false);
});
test("personal adoption retries around a group Step write and retains values outside the new personal version", async t => {
  const f = await groupFixture(client); await f.cards.ensureDeckData("bob", f.deckId, 1);
  await publishGroupCard(f, 0, ["b0", "a0", "c0"]); await f.repo.adoptUpdate("alice", f.experienceId, await reviewedUpdate(f, "card", f.ids[0]));
  await publishGroupCard(f, 0, ["a0", "b0", "d0"]);
  const review = (await f.cards.reviewUpdate("bob", "card", f.ids[0])).review!;
  const original = f.cards.getPersonalUser.bind(f.cards); let release!: () => void, reached!: () => void, once = true;
  const ready = new Promise<void>(resolve => { reached = resolve; }), held = new Promise<void>(resolve => { release = resolve; }); t.after(release);
  t.mock.method(f.cards, "getPersonalUser", async (...args: Parameters<typeof original>) => { const result = await original(...args);
    if (once && args[0] === "bob") { once = false; reached(); await held; } return result; });
  const adoption = f.cards.adoptUpdate("bob", review.command); await ready;
  await f.repo.writeLearning("bob", f.experienceId, f.ids[0], "personal", completion("c0", "skipped", 0, 2));
  release(); await adoption;
  const data = (await f.cards.getPersonalUser("bob"))!.cardsData[0];
  assert.equal(data.cardTemplateVersion, 3); assert.equal(data.items.find(item => item.stepId === "c0")!.completionStatus, "skipped");
  assert.equal((await f.repo.get("bob", f.experienceId)).cards[0].version, 2);
});
test("independent personal activity after the removal read cannot alter its frozen snapshot", async t => {
  const f = await groupFixture(client); await f.cards.ensureDeckData("bob", f.deckId, 1);
  const collection = f.repo.removals(), insert = collection.insertMany.bind(collection);
  let release!: () => void, reached!: () => void, once = true;
  const ready = new Promise<void>(resolve => { reached = resolve; }), held = new Promise<void>(resolve => { release = resolve; }); t.after(release);
  t.mock.method(collection, "insertMany", async (...args: Parameters<typeof insert>) => { if (once) { once = false; reached(); await held; } return insert(...args); });
  t.mock.method(f.repo, "removals", () => collection);
  const removal = f.repo.changeMember("alice", f.experienceId, member("remove-follower", 0)); await ready;
  await f.cards.setCompletion("bob", f.deckId, f.ids[0], "a0", "done"); release(); await removal;
  assert.equal((await f.repo.snapshot("alice", f.experienceId, "bob")).learning[0].items[0].completionStatus, "todo");
  assert.equal((await f.cards.getPersonalUser("bob"))!.cardsData[0].items[0].completionStatus, "done");
});
test("concurrent duplicate adoption commits once and an injected later failure rolls back reference metadata", async t => {
  const f = await groupFixture(client); await publishGroupCard(f, 0, ["b0", "a0", "c0"]);
  const command = await reviewedUpdate(f, "card", f.ids[0]);
  const results = await Promise.all([f.repo.adoptUpdate("alice", f.experienceId, command), f.repo.adoptUpdate("alice", f.experienceId, command)]);
  assert.deepEqual(results.map(result => result.outcome).sort(), ["already-adopted", "updated"]);
  assert.equal((await f.repo.experiences().findOne({ experienceId: f.experienceId }))!.adoptionRevision, 1);
  await publishGroupCard(f, 0, ["a0", "b0", "d0"]); const next = await reviewedUpdate(f, "card", f.ids[0]);
  const before = await f.repo.members().find({ experienceId: f.experienceId }).toArray(), collection = f.repo.experiences();
  t.mock.method(collection, "updateOne", () => { throw Error("Injected adoption failure"); }); t.mock.method(f.repo, "experiences", () => collection);
  await assert.rejects(f.repo.adoptUpdate("alice", f.experienceId, next), /Injected/);
  assert.deepEqual(await f.repo.members().find({ experienceId: f.experienceId }).toArray(), before);
  assert.equal(await f.repo.receipts().countDocuments({ operationId: next.operationId }), 0);
  assert.equal((await collection.findOne({ experienceId: f.experienceId }))!.adoptionRevision, 1);
});
test("missing snapshot generations fail closed and never fall back to live personal values", async t => {
  const f = await groupFixture(client); await f.repo.writeLearning("bob", f.experienceId, f.ids[0], "personal", completion("a0"));
  await f.repo.changeMember("alice", f.experienceId, member("remove-follower", 0));
  await f.repo.removals().updateOne({ experienceId: f.experienceId, userId: "bob", cardTemplateId: f.ids[0] }, { $set: { generation: "wrong-generation" } });
  t.mock.method(f.cards, "users", () => { throw Error("Live personal reads forbidden"); });
  await assert.rejects(f.repo.snapshot("alice", f.experienceId, "bob"), { code: "INVALID_GROUP_SNAPSHOT" });
  await assert.rejects(f.repo.card("alice", f.experienceId, f.ids[0], "follower", "bob"), { code: "INVALID_GROUP_SNAPSHOT" });
});
test("publication after review reads cannot commit an unreviewed Card or new Deck Card selection", async t => {
  for (const kind of ["card", "deck"] as const) {
    const f = await groupFixture(client);
    let index = 0;
    if (kind === "card") await publishGroupCard(f, 0, ["b0", "a0", "c0"]);
    else {
      const extra = await f.cards.createCardDraft("creator", { ...createDefaultCardContent(["new-a", "new-b", "new-c"]), intro: { title: "New", description: null, mediaItem: null } }, "public");
      await f.cards.publishCard("creator", extra.cardTemplateId, 0); f.ids.push(extra.cardTemplateId); index = f.ids.length - 1;
      await publishGroupDeck(f, f.ids);
    }
    const command = await reviewedUpdate(f, kind, kind === "card" ? f.ids[0] : f.deckId), gate = gateBeforeFence(t, f.repo);
    const adoption = f.repo.adoptUpdate("alice", f.experienceId, command), observed = adoption.then(() => null, error => error);
    await gate.ready; await publishGroupCard(f, index, kind === "card" ? ["a0", "b0", "d0"] : ["new-b", "new-a", "new-c"]);
    gate.release(); assert.equal((await observed).code, "GROUP_UPDATE_CONFLICT");
    assert.equal((await f.repo.experiences().findOne({ experienceId: f.experienceId }))!.adoptionRevision, 0);
    assert.equal(await f.repo.receipts().countDocuments(), 0);
  }
});

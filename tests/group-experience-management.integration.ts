import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { MongoClient } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { groupFixture, publishGroupCard, reviewedUpdate, completion } from "./helpers/groupExperiences";
import { GroupExperienceRepository } from "../src/lib/groupExperiences/repository";
import { GROUP_COLLECTIONS } from "../src/lib/groupExperiences/indexes";
let mongo: MongoMemoryReplSet, client: MongoClient;
before(async () => { mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } }); client = await new MongoClient(mongo.getUri()).connect(); });
after(async () => { await client?.close(); await mongo?.stop(); });
const command = (changes = {}) => ({ operationId: "management", expectedStructureRevision: 0, name: "New name",
  adminIds: ["alice", "dave"], followerIds: ["carol", "dave"], allowFollowerInspection: true, ...changes });
async function stored(f: Awaited<ReturnType<typeof groupFixture>>) {
  const result: Record<string, unknown> = {};
  for (const name of [...Object.values(GROUP_COLLECTIONS), "users"]) result[name] = await f.cards.db.collection(name).find({}).sort({ _id: 1 }).toArray();
  return JSON.stringify(result);
}
test("whole-form Save updates all fields, dual roles, snapshots and eligibility without changing personal data", async () => {
  const f = await groupFixture(client); await f.cards.ensureDeckData("bob", f.deckId, 1);
  const personal = JSON.stringify(await f.cards.users().find({}).toArray());
  const result = await f.repo.manage("alice", f.experienceId, command());
  assert.equal(result.structureRevision, 1); assert.equal(result.hasAccess, true);
  const meta = await f.repo.get("alice", f.experienceId); assert.equal(meta.name, "New name"); assert.equal(meta.allowFollowerInspection, true);
  const dave = await f.repo.members().findOne({ experienceId: f.experienceId, userId: "dave" });
  assert.equal(dave!.isAdmin, true); assert.equal(dave!.followerStatus, "active");
  assert.equal((await f.repo.members().findOne({ userId: "bob" }))!.followerStatus, "removed");
  assert.equal((await f.repo.snapshot("alice", f.experienceId, "bob")).learning.length, f.ids.length);
  assert.equal(JSON.stringify(await f.cards.users().find({}).toArray()), personal);
  assert.equal(await f.repo.receipts().countDocuments(), 1);
});
for (const stage of ["member", "snapshot", "experience", "receipt"] as const) test(`Save rolls everything back after ${stage} failure`, async t => {
  const f = await groupFixture(client), before = await stored(f);
  if (stage === "member") { const collection = f.repo.members(); t.mock.method(collection, "insertOne", () => { throw Error(stage); }); t.mock.method(f.repo, "members", () => collection); }
  if (stage === "snapshot") { const collection = f.repo.removals(); t.mock.method(collection, "insertMany", () => { throw Error(stage); }); t.mock.method(f.repo, "removals", () => collection); }
  if (stage === "experience") { const collection = f.repo.experiences(); t.mock.method(collection, "updateOne", () => { throw Error(stage); }); t.mock.method(f.repo, "experiences", () => collection); }
  if (stage === "receipt") t.mock.method(f.repo, "record", () => { throw Error(stage); });
  await assert.rejects(f.repo.manage("alice", f.experienceId, command()), new RegExp(stage));
  assert.equal(await stored(f), before);
});
test("complete final roles permit replacing the editor and replaying exact Save after total self-removal", async () => {
  const f = await groupFixture(client), cmd = command({ adminIds: ["dave"], followerIds: [] });
  const first = await f.repo.manage("alice", f.experienceId, cmd); assert.equal(first.hasAccess, false);
  await assert.rejects(f.repo.get("alice", f.experienceId), { code: "GROUP_FORBIDDEN" });
  const replay = await f.repo.manage("alice", f.experienceId, cmd);
  assert.deepEqual(Object.keys(replay).sort(), ["viewerUserId", "experienceId", "structureRevision", "outcome", "hasAccess"].sort());
  assert.equal(replay.outcome, "already-applied"); assert.equal(replay.hasAccess, false);
  await assert.rejects(f.repo.manage("alice", f.experienceId, { ...cmd, name: "Changed" }), { code: "GROUP_OPERATION_CONFLICT" });
  await assert.rejects(f.repo.manage("alice", f.experienceId, { ...cmd, operationId: "new", expectedStructureRevision: 1 }), { code: "GROUP_FORBIDDEN" });
  await assert.rejects(f.repo.manage("outsider", f.experienceId, cmd), { code: "GROUP_FORBIDDEN" });
  await f.repo.manage("dave", f.experienceId, command({ operationId: "later", expectedStructureRevision: 1, adminIds: ["dave"], followerIds: [] }));
  assert.equal((await f.repo.manage("alice", f.experienceId, cmd)).structureRevision, 1);
});
test("self-demotion retaining follower access and exact parallel retries commit once", async () => {
  const f = await groupFixture(client), cmd = command({ adminIds: ["dave"], followerIds: ["alice"] });
  const results = await Promise.all([f.repo.manage("alice", f.experienceId, cmd), f.repo.manage("alice", f.experienceId, cmd)]);
  assert.ok(results.every(row => row.hasAccess)); assert.equal(await f.repo.receipts().countDocuments(), 1);
  assert.equal((await f.repo.get("alice", f.experienceId)).isAdmin, false);
});
test("stale edits, invalid users/fields, non-admins and no final Admin leave all state unchanged", async () => {
  const f = await groupFixture(client), before = await stored(f);
  for (const [actor, cmd, code] of [
    ["alice", command({ expectedStructureRevision: 99 }), "GROUP_STRUCTURE_CONFLICT"],
    ["alice", command({ adminIds: [] }), "GROUP_FINAL_ADMIN_CONFLICT"],
    ["alice", command({ followerIds: ["missing"] }), "GROUP_USER_UNAVAILABLE"],
    ["alice", command({ allowFollowerInspection: "false" }), "INVALID_GROUP_POLICY"],
    ["alice", command({ followerIds: undefined }), "INVALID_GROUP_MEMBERS"],
    ["alice", command({ actor: "dave" }), "INVALID_GROUP_FIELDS"],
    ["bob", command(), "GROUP_FORBIDDEN"],
  ] as const) { await assert.rejects(f.repo.manage(actor, f.experienceId, cmd), { code }); assert.equal(await stored(f), before); }
});
test("competing Admin forms cannot overwrite or remove the final Admin", async () => {
  const f = await groupFixture(client, { admins: ["bob"] });
  const results = await Promise.allSettled([
    f.repo.manage("alice", f.experienceId, command({ adminIds: ["bob"] })),
    f.repo.manage("bob", f.experienceId, command({ adminIds: ["alice"] })),
  ]);
  assert.equal(results.filter(row => row.status === "fulfilled").length, 1);
  assert.equal((await f.repo.experiences().findOne({ experienceId: f.experienceId }))!.structureRevision, 1);
  assert.equal(await f.repo.members().countDocuments({ experienceId: f.experienceId, isAdmin: true }), 1);
});
test("adoption invalidates an old management form without partial settings changes", async () => {
  const f = await groupFixture(client); await publishGroupCard(f, 0, ["c0", "a0", "b0"]);
  await f.repo.adoptUpdate("alice", f.experienceId, await reviewedUpdate(f, "card", f.ids[0]));
  const before = await stored(f);
  await assert.rejects(f.repo.manage("alice", f.experienceId, command()), { code: "GROUP_STRUCTURE_CONFLICT" });
  assert.equal(await stored(f), before);
});
test("rejoining via management retains live personal values and removal references", async () => {
  const f = await groupFixture(client); await f.repo.manage("alice", f.experienceId, command());
  await f.cards.ensureDeckData("bob", f.deckId, 1); await f.cards.setCompletion("bob", f.deckId, f.ids[0], "a0", "done");
  await f.repo.manage("alice", f.experienceId, command({ operationId: "rejoin", expectedStructureRevision: 1, followerIds: ["bob"] }));
  const row = await f.repo.card("bob", f.experienceId, f.ids[0], "self");
  assert.equal(row.learning.items[0].completionStatus, "done");
});
test("creation stores visibility atomically, preserves legacy hashes and permits zero followers", async () => {
  const f = await groupFixture(client);
  assert.equal((await f.repo.get("alice", f.experienceId)).allowFollowerInspection, false);
  assert.equal((await f.repo.create("alice", f.command)).outcome, "already-created");
  const cmd = { ...f.command, operationId: "visible", adminIds: [], followerIds: [], allowFollowerInspection: true };
  const created = await f.repo.create("alice", cmd);
  const meta = await f.repo.get("alice", created.experienceId); assert.equal(meta.isAdmin, true); assert.equal(meta.isFollower, false); assert.equal(meta.allowFollowerInspection, true);
  assert.equal((await f.repo.create("alice", cmd)).experienceId, created.experienceId);
});
test("creation failure cannot leave policy, assignments or a creation receipt partially stored", async t => {
  const f = await groupFixture(client), before = await stored(f), members = f.repo.members();
  t.mock.method(members, "insertMany", () => { throw Error("creation-member-failure"); }); t.mock.method(f.repo, "members", () => members);
  await assert.rejects(f.repo.create("alice", { ...f.command, operationId: "failed-visible-create", allowFollowerInspection: true }), /creation-member-failure/);
  assert.equal(await stored(f), before);
});
test("lost creation acknowledgement remains actor-bound after subsequent access removal", async () => {
  const f = await groupFixture(client);
  await f.repo.manage("alice", f.experienceId, command({ adminIds: ["dave"], followerIds: [] }));
  const retry = await f.repo.create("alice", f.command);
  assert.deepEqual(retry, { viewerUserId: "alice", experienceId: f.experienceId, hasAccess: false, outcome: "already-created" });
});
for (const removalFirst of [true, false]) test(`atomic management versus learning mutation: removal first ${removalFirst}`, async t => {
  const f = await groupFixture(client), other = new GroupExperienceRepository(f.cards);
  let reached!: () => void, release!: () => void, once = true;
  const ready = new Promise<void>(resolve => { reached = resolve; }), held = new Promise<void>(resolve => { release = resolve; });
  const fence = f.repo.fence.bind(f.repo);
  t.mock.method(f.repo, "fence", async (...args: Parameters<typeof fence>) => { if (once) { once = false; reached(); await held; } return fence(...args); });
  t.after(release);
  const work = (removalFirst ? f.repo.writeLearning("bob", f.experienceId, f.ids[0], "personal", completion("a0"))
    : f.repo.manage("alice", f.experienceId, command())).then(value => ({ value, error: null }), error => ({ value: null, error }));
  await ready;
  if (removalFirst) await other.manage("alice", f.experienceId, command());
  else await other.writeLearning("bob", f.experienceId, f.ids[0], "personal", completion("a0"));
  release(); const result = await work;
  if (removalFirst) assert.equal(result.error.code, "GROUP_FORBIDDEN"); else assert.equal(result.error, null);
  assert.equal((await other.snapshot("alice", f.experienceId, "bob")).learning[0].items[0].completionStatus, removalFirst ? "todo" : "done");
});

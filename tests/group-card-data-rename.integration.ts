import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BSON, MongoClient, type Db } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { executeGroupCardRename, planGroupCardRename, verifyGroupCardRename } from "../scripts/migration/groupCardDataRename";
import { main } from "../scripts/rename-group-card-data";
import { assertGroupExperienceIndexes, createGroupExperienceIndexes, GROUP_COLLECTIONS } from "../src/lib/groupExperiences/indexes";
import { groupFixture, completion } from "./helpers/groupExperiences";
import { GroupExperienceRepository } from "../src/lib/groupExperiences/repository";
import { mutateGroupAssessment, readGroupAssessments } from "../src/lib/groupExperiences/assessments";

let mongo: MongoMemoryReplSet, client: MongoClient;
before(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  client = await new MongoClient(mongo.getUri()).connect();
});
after(async () => { await client?.close(); await mongo?.stop(); });
const database = () => client.db(`switchplay_test_rename_${randomUUID().replaceAll("-", "")}`);
const stored = () => ({ experienceId: "club", cardTemplateId: "removed-card", revision: 12,
  createdAt: new Date("2026-09-01T12:00:00Z"), updatedAt: new Date("2026-10-30T12:00:00Z"),
  items: [{ stepId: "step", completionStatus: "skipped" }], signalReadings: [{ stepId: "step", reading: 7 }],
  testsRevision: 4, tests: [{ id: "result", date: "2026-10-12", result: false, createdAt: new Date("2026-10-13T12:00:00Z"),
    provenance: { enteredByUserId: "coach", entryMethod: "manual", groupExperienceId: "club", deckTemplateId: "deck" } }] });
async function legacy(db: Db, empty = false) {
  await db.createCollection("groupCardState", { validator: { experienceId: { $type: "string" } } });
  const collection = db.collection("groupCardState");
  await collection.createIndex({ experienceId: 1, cardTemplateId: 1 }, { unique: true, name: "group_learning_identity" });
  await collection.createIndex({ updatedAt: -1 }, { name: "existing_extra_index" });
  if (!empty) await collection.insertOne(stored());
}
test("rename preserves exact retained records, BSON dates, options, UUID, indexes and unrelated collections", async () => {
  const db = database(); await legacy(db);
  for (const name of ["users", "groupExperiences", "groupExperienceMembers", "groupOperationReceipts", "groupRemovalLearning"]) await db.collection(name).insertOne({ sentinel: name });
  const before = await db.collection("groupCardState").find().toArray(), plan = await planGroupCardRename(db);
  assert.equal((await executeGroupCardRename(db, plan)).alreadyRenamed, false);
  assert.deepEqual(await verifyGroupCardRename(db, plan), { verified: true, count: 1, planHash: plan.planHash });
  assert.equal(await db.listCollections({ name: "groupCardState" }).hasNext(), false);
  assert.equal(BSON.EJSON.stringify(await db.collection("groupCardData").find().toArray()), BSON.EJSON.stringify(before));
  await assert.rejects(db.collection("groupCardData").insertOne(stored()), { code: 11000 });
  await assert.rejects(db.collection("groupCardData").insertOne({ experienceId: 123 }), { code: 121 });
  assert.equal((await db.collection("groupCardData").indexes()).some(index => index.name === "existing_extra_index"), true);
  for (const name of ["users", "groupExperiences", "groupExperienceMembers", "groupOperationReceipts", "groupRemovalLearning"]) {
    assert.equal(await db.collection(name).countDocuments(), 1); assert.equal((await db.collection(name).findOne())!.sentinel, name);
  }
});
test("lost response retry verifies the same namespace identity without duplicating data", async () => {
  const db = database(); await legacy(db); const plan = await planGroupCardRename(db);
  await executeGroupCardRename(db, plan);
  assert.equal((await executeGroupCardRename(db, plan)).alreadyRenamed, true);
  await db.collection("groupCardData").updateOne({}, { $inc: { revision: 1 } });
  await assert.rejects(executeGroupCardRename(db, plan), { code: "RENAME_SOURCE_DRIFT" });
});
test("empty existing collection renames; absent source never creates a collection", async () => {
  const db = database(); await legacy(db, true); const plan = await planGroupCardRename(db);
  assert.equal(plan.snapshot.count, 0); await executeGroupCardRename(db, plan);
  const fresh = database(); await assert.rejects(planGroupCardRename(fresh), { code: "RENAME_SOURCE_MISSING" });
  assert.equal(await fresh.listCollections().hasNext(), false);
});
test("both namespaces, even an empty target, refuse execution and provisioning without losing either", async () => {
  const db = database(); await legacy(db); const plan = await planGroupCardRename(db);
  await db.createCollection("groupCardData");
  await assert.rejects(planGroupCardRename(db), { code: "RENAME_TARGET_EXISTS" });
  await assert.rejects(executeGroupCardRename(db, plan), { code: "RENAME_NAMESPACE_CONFLICT" });
  await assert.rejects(createGroupExperienceIndexes(db), { code: "GROUP_CARD_RENAME_REQUIRED" });
  await assert.rejects(assertGroupExperienceIndexes(db), { code: "GROUP_CARD_RENAME_REQUIRED" });
  assert.equal(await db.collection("groupCardState").countDocuments(), 1);
  assert.equal(await db.collection("groupCardData").countDocuments(), 0);
});
test("source drift, wrong database and altered plans fail before namespace changes", async () => {
  const db = database(); await legacy(db); const plan = await planGroupCardRename(db);
  await assert.rejects(executeGroupCardRename(database(), plan), { code: "RENAME_DATABASE_MISMATCH" });
  await assert.rejects(executeGroupCardRename(db, { ...plan, to: "users" }), { code: "INVALID_RENAME_PLAN" });
  await db.collection("groupCardState").updateOne({}, { $inc: { testsRevision: 1 } });
  await assert.rejects(executeGroupCardRename(db, plan), { code: "RENAME_SOURCE_DRIFT" });
  assert.equal(await db.listCollections({ name: "groupCardData" }).hasNext(), false);
});
test("provisioning refuses legacy-only storage; fresh provisioning is repeatable and only creates the new namespace", async () => {
  const old = database(); await legacy(old);
  await assert.rejects(createGroupExperienceIndexes(old), { code: "GROUP_CARD_RENAME_REQUIRED" });
  assert.equal(await old.listCollections({ name: "groupCardData" }).hasNext(), false);
  const fresh = database(); await createGroupExperienceIndexes(fresh); await createGroupExperienceIndexes(fresh);
  await assertGroupExperienceIndexes(fresh); assert.equal(GROUP_COLLECTIONS.cardData, "groupCardData");
  assert.equal(await fresh.listCollections({ name: "groupCardState" }).hasNext(), false);
});
test("rollback uses a fresh reverse plan and preserves writes made after forward migration", async () => {
  const db = database(); await legacy(db); await executeGroupCardRename(db, await planGroupCardRename(db));
  await db.collection("groupCardData").updateOne({}, { $inc: { revision: 1 } });
  const reverse = await planGroupCardRename(db, true); await executeGroupCardRename(db, reverse);
  assert.equal((await db.collection("groupCardState").findOne())!.revision, 13);
  assert.equal(await db.listCollections({ name: "groupCardData" }).hasNext(), false);
});
test("a migrated Group resumes learning and assessment operations without modifying personal data", async () => {
  const f = await groupFixture(client), cardTemplateId = f.ids[0], source = { kind: "card" as const, cardTemplateId };
  await f.repo.writeLearning("alice", f.experienceId, cardTemplateId, "group", completion("a0"));
  const add = { viewerUserId: "alice", target: { cardTemplateId }, action: "add" as const, id: "before", expectedRevision: 0, date: "2026-10-20", result: true };
  await mutateGroupAssessment(f.repo, "alice", f.experienceId, source, add);
  const people = BSON.EJSON.stringify(await f.cards.users().find().sort({ _id: 1 }).toArray());
  await f.repo.cardData().rename("groupCardState", { dropTarget: false });
  const restarted = new GroupExperienceRepository(f.cards);
  await assert.rejects(restarted.get("alice", f.experienceId), { code: "GROUP_CARD_RENAME_REQUIRED" });
  await executeGroupCardRename(f.cards.db, await planGroupCardRename(f.cards.db));
  assert.equal((await readGroupAssessments(restarted, "alice", f.experienceId, source)).tests[0].id, "before");
  await restarted.writeLearning("alice", f.experienceId, cardTemplateId, "group", completion("b0"));
  const next = await mutateGroupAssessment(restarted, "alice", f.experienceId, source, { ...add, id: "after", expectedRevision: 1 });
  assert.equal(next.revision, 2); assert.equal(next.tests.length, 2);
  const row = await restarted.cardData().findOne({ experienceId: f.experienceId, cardTemplateId });
  assert.equal(row!.items.filter(step => step.completionStatus === "done").length, 2);
  assert.equal(BSON.EJSON.stringify(await f.cards.users().find().sort({ _id: 1 }).toArray()), people);
  await assert.rejects(mutateGroupAssessment(restarted, "bob", f.experienceId, source, { ...add, viewerUserId: "bob", id: "forged", expectedRevision: 2 }), { code: "GROUP_FORBIDDEN" });
});
test("explicit CLI inspects, writes a private plan, executes, verifies and recovers a lost acknowledgement", async () => {
  const db = database(); await legacy(db); const dir = await mkdtemp(join(tmpdir(), "group-card-rename-"));
  const file = join(dir, "plan.json"), env = { GROUP_CARD_RENAME_URI: mongo.getUri(), GROUP_CARD_RENAME_DB: db.databaseName };
  try {
    assert.equal(await main(["--inspect", "--mode", "disposable"], env), 0);
    assert.equal(await main(["--plan", "--mode", "disposable", "--file", file], env), 0);
    assert.equal((await stat(file)).mode & 0o777, 0o600);
    assert.equal((await readFile(file, "utf8")).includes("enteredByUserId"), false);
    assert.equal(await main(["--execute", "--mode", "disposable", "--file", file], env), 1);
    const args = ["--execute", "--mode", "disposable", "--file", file, "--confirm", db.databaseName, "--writers-stopped"];
    assert.equal(await main(args, env), 0); assert.equal(await main(args, env), 0);
    assert.equal(await main(["--verify", "--mode", "disposable", "--file", file], env), 0);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test("CLI refuses ambient application credentials, remote disposable targets and unconfirmed persistent execution", async () => {
  assert.equal(await main(["--help"], {}), 0);
  assert.equal(await main(["--inspect", "--mode", "disposable"], { MONGODB_URI: mongo.getUri(), MONGODB_DB: "switchplay" }), 1);
  assert.equal(await main(["--inspect", "--mode", "disposable"], { GROUP_CARD_RENAME_URI: "mongodb+srv://example.mongodb.net", GROUP_CARD_RENAME_DB: "switchplay_test_rename" }), 1);
  assert.equal(await main(["--execute", "--mode", "production", "--file", "not-opened.json", "--confirm", "switchplay", "--writers-stopped"], {
    GROUP_CARD_RENAME_URI: "mongodb+srv://example.mongodb.net/switchplay", GROUP_CARD_RENAME_DB: "switchplay", GROUP_CARD_RENAME_HOST: "example.mongodb.net",
  }), 1); // fails the backup confirmation before any file or network access
});

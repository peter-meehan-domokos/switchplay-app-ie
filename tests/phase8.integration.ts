import assert from "node:assert/strict";
import { before, after, beforeEach, test } from "node:test";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { MongoClient, type Db } from "mongodb";
import { createPhase8Plan, executePhase8, documentSetHash, ORIGINAL_COLLECTIONS, verifyPhase8 } from "../scripts/migration/phase8";
import { phase8Fixture } from "./fixtures/phase8";

let server: MongoMemoryReplSet, client: MongoClient, db: Db;
before(async () => { server = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } }); client = await new MongoClient(server.getUri()).connect(); db = client.db("switchplay"); });
// This suite owns its loopback server; it never reads an environment URI.
beforeEach(async () => { await db.dropDatabase(); });
after(async () => { await client?.close(); await server?.stop(); });
async function setup() {
  const backup = await phase8Fixture(); const plan = createPhase8Plan("/fixture-backup", backup);
  for (const name of ORIGINAL_COLLECTIONS) await db.collection(name).insertMany(backup.sources[name]);
  return { plan, backup };
}
test("rename then transactional population preserves originals, ancillary records, identities and exact retry", async () => {
  const { plan, backup } = await setup(); await executePhase8(client, db, plan);
  assert.equal((await verifyPhase8(db, plan)).valid, true);
  for (const name of ORIGINAL_COLLECTIONS) assert.equal(documentSetHash(await db.collection(`legacy_${name}`).find({}).toArray()), documentSetHash(backup.sources[name]));
  assert.equal(await db.collection("cardTemplates").countDocuments(), 41);
  assert.equal(await db.collection("users").countDocuments(), 11);
  assert.equal(documentSetHash(await db.collection("earlyAccessSignups").find({}).toArray()), documentSetHash(backup.sources.earlyAccessSignups));
  assert.equal((await executePhase8(client, db, plan)).reused, true);
  await db.collection("users").updateOne({ _id: backup.sources.users[0]._id }, { $set: { reflection: "new work" } });
  await assert.rejects(executePhase8(client, db, plan), { code: "CONFLICTING_OR_PARTIAL_TARGET_REFUSED" });
});
test("collision, changed source and partial rename stop without overwriting originals", async () => {
  const { plan, backup } = await setup();
  await db.collection("legacy_users").insertOne({ important: true });
  await assert.rejects(executePhase8(client, db, plan), { code: "PARTIAL_RENAME_REQUIRES_REVIEW" });
  assert.equal(await db.collection("users").countDocuments(), 11);
  // Recovery setup is on this suite's disposable database only.
  await db.collection("legacy_users").drop();
  await db.collection("users").updateOne({ _id: backup.sources.users[0]._id }, { $set: { changed: true } });
  await assert.rejects(executePhase8(client, db, plan), { code: "SOURCE_DRIFT_REQUIRES_REVIEW" });
  assert.equal(await db.collection("deckTemplates").countDocuments(), 41);
});
test("failure rolls back every new document while retaining renamed originals; approved empty retry works", async () => {
  const { plan } = await setup();
  for (const name of ORIGINAL_COLLECTIONS) await db.collection(name).rename(`legacy_${name}`);
  await db.createCollection("users", { validator: { impossibleField: { $exists: true } } });
  await assert.rejects(executePhase8(client, db, plan));
  for (const name of [...Object.keys(plan.migration.targets), ...Object.keys(plan.ancillary)]) assert.equal(await db.collection(name).countDocuments(), 0);
  assert.equal(await db.collection("legacy_users").countDocuments(), 11);
  await db.command({ collMod: "users", validator: {} });
  assert.equal((await executePhase8(client, db, plan)).reused, false);
});
test("unexpected database, collection and autonomous expiry refuse execution before rename", async () => {
  const { plan } = await setup();
  await assert.rejects(executePhase8(client, client.db("other"), plan), { code: "UNEXPECTED_PRODUCTION_DATABASE" });
  await db.collection("unexpected").insertOne({ important: true });
  await assert.rejects(executePhase8(client, db, plan), { code: "UNEXPECTED_COLLECTIONS" });
  await db.collection("unexpected").drop();
  await db.collection("users").createIndex({ expires: 1 }, { expireAfterSeconds: 3600 });
  await assert.rejects(executePhase8(client, db, plan), { code: "TTL_INDEX_REQUIRES_REVIEW" });
  assert.equal(await db.collection("users").countDocuments(), 11);
});
test("completed targets do not bypass collection inventory checks on verification or retry", async () => {
  const { plan } = await setup();
  await executePhase8(client, db, plan);
  const before = documentSetHash(await db.collection("legacy_users").find({}).toArray());
  await db.collection("unexpected").insertOne({ fixture: true });
  await assert.rejects(verifyPhase8(db, plan), { code: "UNEXPECTED_COLLECTIONS" });
  await assert.rejects(executePhase8(client, db, plan), { code: "UNEXPECTED_COLLECTIONS" });
  assert.equal(documentSetHash(await db.collection("legacy_users").find({}).toArray()), before);
  assert.equal(await db.collection("unexpected").countDocuments(), 1);
});

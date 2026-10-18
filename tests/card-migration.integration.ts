import assert from "node:assert/strict";
import { readFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { before, after, test } from "node:test";
import { MongoClient } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { applyMigrationPlan, inspectTargets } from "../scripts/migration/apply";
import { createMigrationPlan, validateMigrationPlan } from "../scripts/migration/plan";
import { CardRepository } from "../src/lib/cards/repository";
import { resolveWorkingDeck } from "../src/lib/cards/resolvers";
import { main } from "../scripts/migrate-first-class-cards";
import { fingerprint } from "../scripts/audit-pre-library-migration.mjs";

let server: MongoMemoryReplSet; let client: MongoClient; let sequence = 0;
before(async () => {
  server = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  client = await new MongoClient(server.getUri()).connect();
});
after(async () => { await client?.close(); await server?.stop(); });
async function plan() { return createMigrationPlan(JSON.parse(await readFile("tests/fixtures/first-class-migration.json", "utf8"))); }

test("migration commits complete graph on replica set and exact rerun is a no-op", async () => {
  const migration = await plan(); const db = client.db(`switchplay_migration_apply_${sequence++}`);
  assert.equal((await applyMigrationPlan(client, db, migration)).applied, true);
  assert.equal((await inspectTargets(db, migration)).exact, true);
  assert.equal(validateMigrationPlan(migration).valid, true);
  assert.equal((await applyMigrationPlan(client, db, migration)).reused, true);
  assert.equal(await db.collection("cardTemplates").countDocuments(), 2);
  const repo = new CardRepository(db, client);
  const resolved = await resolveWorkingDeck(repo, "alice", "deck-1");
  assert.equal(resolved?.mode, "working");
  if (resolved?.mode === "working") { assert.equal(resolved.cards[0].data?.mediaItems.length, 2); assert.equal(resolved.cards[0].version.version, 1); }
  const indexes = await db.collection("cardTemplates").indexes();
  assert.ok(indexes.some((index) => index.key.cardTemplateId === 1 && index.unique));
  assert.ok(indexes.some((index) => index.key.stepIds === 1 && index.unique));
});
test("conflicting or partially populated targets are refused, without overwrite", async () => {
  const migration = await plan(); const db = client.db(`switchplay_migration_conflict_${sequence++}`);
  await db.collection("deckTemplates").insertOne({ deckTemplateId: "existing", important: "Do not replace" });
  await assert.rejects(applyMigrationPlan(client, db, migration), { code: "CONFLICTING_OR_PARTIAL_TARGET_REFUSED" });
  assert.equal((await db.collection("deckTemplates").findOne({ deckTemplateId: "existing" }))!.important, "Do not replace");
  assert.equal(await db.collection("cardTemplates").countDocuments(), 0);
});
test("user insert failure rolls back every Card/Deck/version output", async () => {
  const migration = await plan(); const db = client.db(`switchplay_migration_rollback_${sequence++}`);
  await db.createCollection("users", { validator: { impossibleRequiredField: { $exists: true } } });
  await assert.rejects(applyMigrationPlan(client, db, migration));
  for (const collection of Object.keys(migration.targets)) assert.equal(await db.collection(collection).countDocuments(), 0);
  await db.command({ collMod: "users", validator: {} });
  assert.equal((await applyMigrationPlan(client, db, migration)).applied, true);
});
test("changed target after successful migration is refused on rerun", async () => {
  const migration = await plan(); const db = client.db(`switchplay_migration_drift_${sequence++}`);
  await applyMigrationPlan(client, db, migration);
  await new CardRepository(db, client).users().updateOne({ _id: "alice" }, { $set: { "cardsData.0.reflection": "New real work" } });
  await assert.rejects(applyMigrationPlan(client, db, migration), { code: "CONFLICTING_OR_PARTIAL_TARGET_REFUSED" });
});
test("apply rejects non-disposable database names before any writes", async () => {
  const migration = await plan();
  await assert.rejects(applyMigrationPlan(client, client.db("ordinary_application_database"), migration), { code: "DISPOSABLE_TARGET_DATABASE_REQUIRED" });
});

test("CLI reads a disposable legacy clone without mutations and applies to a separate disposable target", async (t) => {
  t.mock.method(console, "log", () => {});
  const sourceName = `switchplay_migration_cli_source_${sequence++}`; const targetName = `switchplay_migration_cli_target_${sequence++}`;
  const sources = JSON.parse(await readFile("tests/fixtures/first-class-migration.json", "utf8"));
  const source = client.db(sourceName); await source.collection("deckTemplates").insertMany(sources.deckTemplates); await source.collection("users").insertMany(sources.users);
  await mkdir("migration-plans", { recursive: true }); const directory = await mkdtemp(join("migration-plans", "integration-source-"));
  const planPath = join(directory, "plan.ejson");
  try {
    assert.equal(await main(["--source", "--plan", planPath], { MIGRATION_SOURCE_URI: server.getUri(), MIGRATION_SOURCE_DB: sourceName }), 0);
    assert.equal(await main(["--apply", "--plan", planPath], { MIGRATION_TARGET_URI: server.getUri(), MIGRATION_TARGET_DB: targetName }), 0);
    assert.equal(await client.db(targetName).collection("cardTemplates").countDocuments(), 2);
    assert.equal(fingerprint(await source.collection("deckTemplates").find({}).toArray()), fingerprint(sources.deckTemplates));
    assert.equal(fingerprint(await source.collection("users").find({}).toArray()), fingerprint(sources.users));
  } finally { await rm(directory, { recursive: true, force: true }); }
});

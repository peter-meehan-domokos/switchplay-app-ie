import { type Db, type Document, type MongoClient } from "mongodb";
import { fingerprint } from "../audit-pre-library-migration.mjs";
import { withMongoTransaction } from "../../src/lib/mongodb";
import { createFoundationIndexes } from "../../src/lib/cards/repository";
import { requireCondition } from "../../src/lib/cards/domain";
import { validateMigrationPlan, type MigrationPlan } from "./plan";

function targetView(collection: string, document: Document) {
  if (collection === "users") return document;
  const { _id: _generated, ...body } = document; void _generated; return body;
}
export async function inspectTargets(db: Db, plan: MigrationPlan) {
  let empty = true; let exact = true;
  for (const [collection, expected] of Object.entries(plan.targets)) {
    const actual = await db.collection(collection).find({}).toArray();
    if (actual.length) empty = false;
    const hashes = (documents: Document[]) => documents.map((doc) => fingerprint(targetView(collection, doc))).sort();
    if (fingerprint(hashes(actual)) !== fingerprint(hashes(expected))) exact = false;
  }
  return { empty, exact };
}

// Phase 1 can write only explicitly named disposable LOCAL targets. This is not
// a production cutover command. No source database is ever mutated or renamed.
export async function applyMigrationPlan(client: MongoClient, db: Db, plan: MigrationPlan) {
  requireCondition(/^switchplay_migration_[a-zA-Z0-9_-]+$/.test(db.databaseName), "DISPOSABLE_TARGET_DATABASE_REQUIRED");
  const address = client.options.hosts;
  requireCondition(address.length > 0 && address.every((host) => host.host !== undefined && ["localhost", "127.0.0.1", "::1"].includes(host.host)), "LOCAL_MIGRATION_TARGET_REQUIRED");
  validateMigrationPlan(plan);
  const before = await inspectTargets(db, plan);
  if (before.exact) return { applied: false, reused: true, validation: validateMigrationPlan(plan) };
  requireCondition(before.empty, "CONFLICTING_OR_PARTIAL_TARGET_REFUSED");
  await populateMigrationTargets(client, db, plan);
  const after = await inspectTargets(db, plan);
  requireCondition(after.exact, "POST_APPLY_TARGET_DRIFT");
  return { applied: true, reused: false, validation: validateMigrationPlan(plan) };
}

// Callers own connection/namespace authorization. Kept separate from the guarded
// local apply entry point so production preparation cannot relax its restrictions.
export async function populateMigrationTargets(client: MongoClient, db: Db, plan: MigrationPlan, extraTargets: Record<string, Document[]> = {}) {
  validateMigrationPlan(plan);
  requireCondition(Object.keys(extraTargets).every((name) => !Object.hasOwn(plan.targets, name) && !name.startsWith("legacy_")), "INVALID_EXTRA_TARGET");
  await createFoundationIndexes(db);
  await withMongoTransaction(client, async (session) => {
    for (const [collection, documents] of Object.entries({ ...plan.targets, ...extraTargets })) {
      requireCondition(await db.collection(collection).countDocuments({}, { session }) === 0, "TARGET_CHANGED_BEFORE_APPLY");
      // Driver inserts add _id to their input. Keep the persisted plan unchanged.
      if (documents.length) await db.collection(collection).insertMany(documents.map((document) => ({ ...document })), { session });
    }
  });
}

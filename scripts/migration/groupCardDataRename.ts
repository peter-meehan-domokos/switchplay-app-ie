import { createHash } from "node:crypto";
import { BSON, type Db } from "mongodb";
import { requireCondition } from "../../src/lib/cards/domain";

const oldName = "groupCardState", newName = "groupCardData";
const digest = (value: unknown) => createHash("sha256").update(BSON.EJSON.stringify(value, { relaxed: false })).digest("hex");
export type RenameSnapshot = { uuid: string; count: number; documents: string; options: string; indexes: string };
export type GroupCardRenamePlan = {
  version: 1; database: string; from: string; to: string; snapshot: RenameSnapshot; planHash: string;
};
async function namespaces(db: Db) {
  return new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map(row => row.name));
}
async function snapshot(db: Db, name: string): Promise<RenameSnapshot> {
  const info = await db.listCollections({ name }, { nameOnly: false }).next();
  requireCondition(info?.type === "collection" && info.info?.uuid, "RENAME_COLLECTION_REQUIRED");
  const hash = createHash("sha256"); let count = 0;
  for await (const row of db.collection(name).find({}).sort({ _id: 1 })) {
    hash.update(BSON.EJSON.stringify(row, { relaxed: false })); hash.update("\n"); count++;
  }
  const indexes = (await db.collection(name).listIndexes().toArray()).sort((a, b) => a.name!.localeCompare(b.name!));
  return { uuid: digest(info!.info!.uuid), count, documents: hash.digest("hex"), options: digest(info!.options), indexes: digest(indexes) };
}
export function validateGroupCardRenamePlan(plan: GroupCardRenamePlan) {
  requireCondition(plan && plan.version === 1 && typeof plan.database === "string" && plan.database.length > 0
    && (plan.from === oldName && plan.to === newName || plan.from === newName && plan.to === oldName), "INVALID_RENAME_PLAN");
  const { planHash, ...body } = plan;
  requireCondition(planHash === digest(body) && Number.isSafeInteger(plan.snapshot?.count) && plan.snapshot.count >= 0
    && [plan.snapshot.uuid, plan.snapshot.documents, plan.snapshot.options, plan.snapshot.indexes].every(value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value)), "INVALID_RENAME_PLAN");
}
export async function planGroupCardRename(db: Db, reverse = false): Promise<GroupCardRenamePlan> {
  const from = reverse ? newName : oldName, to = reverse ? oldName : newName, names = await namespaces(db);
  requireCondition(!names.has(to), "RENAME_TARGET_EXISTS");
  requireCondition(names.has(from), "RENAME_SOURCE_MISSING");
  const body = { version: 1 as const, database: db.databaseName, from, to, snapshot: await snapshot(db, from) };
  return { ...body, planHash: digest(body) };
}
async function check(db: Db, name: string, plan: GroupCardRenamePlan) {
  requireCondition(digest(await snapshot(db, name)) === digest(plan.snapshot), "RENAME_SOURCE_DRIFT");
}
export async function verifyGroupCardRename(db: Db, plan: GroupCardRenamePlan) {
  validateGroupCardRenamePlan(plan);
  requireCondition(db.databaseName === plan.database, "RENAME_DATABASE_MISMATCH");
  const names = await namespaces(db);
  requireCondition(!names.has(plan.from) && names.has(plan.to), "RENAME_NAMESPACE_CONFLICT");
  await check(db, plan.to, plan);
  return { verified: true, count: plan.snapshot.count, planHash: plan.planHash };
}
export async function executeGroupCardRename(db: Db, plan: GroupCardRenamePlan) {
  validateGroupCardRenamePlan(plan);
  requireCondition(db.databaseName === plan.database, "RENAME_DATABASE_MISMATCH");
  const names = await namespaces(db);
  requireCondition(!(names.has(plan.from) && names.has(plan.to)), "RENAME_NAMESPACE_CONFLICT");
  if (!names.has(plan.from) && names.has(plan.to)) return { ...await verifyGroupCardRename(db, plan), alreadyRenamed: true };
  requireCondition(names.has(plan.from), "RENAME_SOURCE_MISSING");
  await check(db, plan.from, plan);
  // Offline operation: callers must stop/drain all application writers first.
  // Never copy/drop data or overwrite an existing target, including an empty one.
  await db.collection(plan.from).rename(plan.to, { dropTarget: false });
  return { ...await verifyGroupCardRename(db, plan), alreadyRenamed: false };
}

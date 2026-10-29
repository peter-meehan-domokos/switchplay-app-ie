import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { BSON, type Db, type Document, type MongoClient } from "mongodb";
import { fingerprint } from "../audit-pre-library-migration.mjs";
import { requireCondition } from "../../src/lib/cards/domain";
import { createMigrationPlan, validateMigrationPlan, type MigrationPlan } from "./plan";
import { inspectTargets, populateMigrationTargets } from "./apply";

export const ORIGINAL_COLLECTIONS = ["deckTemplates", "users", "earlyAccessSignups", "creatorInterestSubmissions", "contactSupportSubmissions"] as const;
export const BACKUP_COUNTS = { deckTemplates: 41, users: 11, earlyAccessSignups: 5, creatorInterestSubmissions: 4, contactSupportSubmissions: 1 };
export type OriginalSources = Record<typeof ORIGINAL_COLLECTIONS[number], Document[]>;
type IndexDefinition = { key: Document; name: string; [key: string]: unknown };
export type Phase8Plan = {
  schemaVersion: 1; database: "switchplay"; backupDirectory: string; backupRestoreVerified: false;
  backupFiles: Record<string, string>; sourceHashes: Record<string, string>; counts: Record<string, number>;
  ancillary: Record<string, Document[]>; ancillaryIndexes: Record<string, IndexDefinition[]>;
  migration: MigrationPlan; planHash: string;
  discardedMockMediaReferences: number;
  policy: "approved-original-demo-reset";
};
export function decodeBsonFile(bytes: Buffer): Document[] {
  const documents: Document[] = [];
  for (let offset = 0; offset < bytes.length;) {
    requireCondition(bytes.length - offset >= 4, "INVALID_BACKUP_BSON");
    const size = bytes.readInt32LE(offset);
    requireCondition(size >= 5 && offset + size <= bytes.length, "INVALID_BACKUP_BSON");
    documents.push(BSON.deserialize(bytes.subarray(offset, offset + size))); offset += size;
  }
  return documents;
}
export function documentSetHash(documents: Document[]) {
  return fingerprint(documents.map((document) => fingerprint(document)).sort());
}
export async function readBackup(directory: string) {
  const sources = {} as OriginalSources; const files: Record<string, string> = {}; const indexes: Record<string, IndexDefinition[]> = {};
  const names = await readdir(directory);
  requireCondition(names.filter((name) => name.endsWith(".bson")).every((name) => ORIGINAL_COLLECTIONS.includes(name.slice(0, -5) as typeof ORIGINAL_COLLECTIONS[number])), "UNEXPECTED_BACKUP_COLLECTION");
  for (const name of ORIGINAL_COLLECTIONS) {
    for (const suffix of ["bson", "metadata.json"]) {
      const filename = `${name}.${suffix}`; const bytes = await readFile(join(directory, filename));
      files[filename] = createHash("sha256").update(bytes).digest("hex");
      if (suffix === "bson") sources[name] = decodeBsonFile(bytes);
      else {
        const metadata = BSON.EJSON.parse(bytes.toString("utf8"));
        requireCondition(Array.isArray(metadata.indexes), "INVALID_BACKUP_INDEX_METADATA");
        indexes[name] = metadata.indexes;
      }
    }
  }
  return { sources, files, indexes };
}
function phase8Hash(plan: Phase8Plan) { const { planHash: _hash, ...body } = plan; void _hash; return fingerprint(body); }
export function preservationExceptions(sources: OriginalSources) {
  return sources.deckTemplates.filter((deck) => deck.savedTemplate && fingerprint(deck.savedTemplate) !== fingerprint(deck.template))
    .map((deck) => ({ code: "OUTSTANDING_SAVED_TEMPLATE", deckTemplateId: deck.deckTemplateId }));
}
export function createPhase8Plan(directory: string, backup: Awaited<ReturnType<typeof readBackup>>, previous?: Phase8Plan): Phase8Plan {
  const { sources, files, indexes } = backup;
  requireCondition(ORIGINAL_COLLECTIONS.every((name) => sources[name].length === BACKUP_COUNTS[name]), "UNEXPECTED_BACKUP_COUNTS");
  requireCondition(preservationExceptions(sources).length === 0, "OUTSTANDING_DRAFT_REQUIRES_DECISION");
  requireCondition(sources.users.every((user) => BSON.ObjectId.isValid(user._id) && !Object.hasOwn(user, "cardsData") && !user.itemTests?.length), "NEW_SCHEMA_OR_ITEM_TESTS_REQUIRE_DECISION");
  const sourceHashes = Object.fromEntries(ORIGINAL_COLLECTIONS.map((name) => [name, documentSetHash(sources[name])]));
  if (previous) {
    validatePhase8Plan(previous);
    requireCondition(fingerprint(previous.backupFiles) === fingerprint(files) && fingerprint(previous.sourceHashes) === fingerprint(sourceHashes), "BACKUP_DRIFT_REQUIRES_NEW_PLAN");
    return previous;
  }
  const migrationUsers = BSON.deserialize(BSON.serialize({ users: sources.users })).users as Document[];
  let discardedMockMediaReferences = 0;
  for (const user of migrationUsers) for (const deck of user.decksData ?? []) for (const card of deck.cards ?? []) {
    if (!Array.isArray(card.mediaItems)) continue;
    card.mediaItems = card.mediaItems.filter((item: Document) => {
      const discarded = item?.mediaType === "image" && item.provider === undefined && item.src === "/images/media-traces/gym-trace-01.png";
      if (discarded) discardedMockMediaReferences++; return !discarded;
    });
  }
  // Only this explicitly discarded mock reference is omitted. Originals and
  // outer source hashes still include it; the shared legacy planner is unchanged.
  const migration = createMigrationPlan({ deckTemplates: sources.deckTemplates, users: migrationUsers });
  const ancillary = BSON.deserialize(BSON.serialize({ value: Object.fromEntries(ORIGINAL_COLLECTIONS.slice(2).map((name) => [name, sources[name]])) })).value as Record<string, Document[]>;
  const plan: Phase8Plan = { schemaVersion: 1, database: "switchplay", backupDirectory: directory, backupRestoreVerified: false,
    backupFiles: files, sourceHashes, counts: Object.fromEntries(ORIGINAL_COLLECTIONS.map((name) => [name, sources[name].length])),
    ancillary, ancillaryIndexes: Object.fromEntries(ORIGINAL_COLLECTIONS.slice(2).map((name) => [name, indexes[name]])),
    migration, discardedMockMediaReferences, policy: "approved-original-demo-reset", planHash: "" };
  plan.planHash = phase8Hash(plan); validatePhase8Plan(plan); return plan;
}
export function validatePhase8Plan(plan: Phase8Plan) {
  requireCondition(plan.schemaVersion === 1 && plan.database === "switchplay" && plan.backupRestoreVerified === false
    && plan.policy === "approved-original-demo-reset" && Number.isInteger(plan.discardedMockMediaReferences)
    && plan.discardedMockMediaReferences >= 0 && plan.planHash === phase8Hash(plan), "INVALID_PHASE8_PLAN");
  validateMigrationPlan(plan.migration);
  requireCondition(fingerprint(Object.keys(plan.ancillary).sort()) === fingerprint([...ORIGINAL_COLLECTIONS.slice(2)].sort()), "INVALID_ANCILLARY_TARGETS");
  for (const name of ORIGINAL_COLLECTIONS) requireCondition(plan.counts[name] === BACKUP_COUNTS[name], "INVALID_PHASE8_COUNTS");
}
async function checkSource(db: Db, plan: Phase8Plan, prefix: string) {
  for (const name of ORIGINAL_COLLECTIONS) {
    const documents = await db.collection(`${prefix}${name}`).find({}).toArray();
    requireCondition(documents.length === plan.counts[name] && documentSetHash(documents) === plan.sourceHashes[name], "SOURCE_DRIFT_REQUIRES_REVIEW");
    requireCondition((await db.collection(`${prefix}${name}`).indexes()).every((index) => index.expireAfterSeconds === undefined), "TTL_INDEX_REQUIRES_REVIEW");
  }
}
async function inspectAncillary(db: Db, plan: Phase8Plan) {
  let empty = true, exact = true;
  for (const [name, expected] of Object.entries(plan.ancillary)) {
    const actual = await db.collection(name).find({}).toArray();
    if (actual.length) empty = false;
    if (documentSetHash(actual) !== documentSetHash(expected)) exact = false;
  }
  return { empty, exact };
}
async function createAncillaryIndexes(db: Db, plan: Phase8Plan) {
  for (const [name, definitions] of Object.entries(plan.ancillaryIndexes)) {
    for (const definition of definitions) {
      if (definition.name === "_id_") continue;
      requireCondition(definition.expireAfterSeconds === undefined, "TTL_INDEX_REQUIRES_REVIEW");
      const { key, name: indexName, unique, sparse, partialFilterExpression, collation } = definition;
      await db.collection(name).createIndex(key, { name: indexName,
        ...(unique !== undefined ? { unique: Boolean(unique) } : {}), ...(sparse !== undefined ? { sparse: Boolean(sparse) } : {}),
        ...(partialFilterExpression ? { partialFilterExpression: partialFilterExpression as Document } : {}),
        ...(collation ? { collation: collation as { locale: string } } : {}) });
    }
  }
}
// A small namespace state check, not an automatic repair system. Mixed states
// need an operator to investigate and explicitly authorize recovery.
export async function executePhase8(client: MongoClient, db: Db, plan: Phase8Plan) {
  validatePhase8Plan(plan); requireCondition(db.databaseName === "switchplay", "UNEXPECTED_PRODUCTION_DATABASE");
  const names = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map(({ name }) => name));
  const original = ORIGINAL_COLLECTIONS.every((name) => names.has(name));
  const legacy = ORIGINAL_COLLECTIONS.every((name) => names.has(`legacy_${name}`));
  if (legacy) {
    await checkSource(db, plan, "legacy_");
    requireCondition([...names].every((name) => ORIGINAL_COLLECTIONS.some((original) => name === `legacy_${original}`)
      || Object.hasOwn(plan.migration.targets, name) || Object.hasOwn(plan.ancillary, name)), "UNEXPECTED_COLLECTIONS");
    const target = await inspectTargets(db, plan.migration), extra = await inspectAncillary(db, plan);
    if (target.exact && extra.exact) { await verifyPhase8(db, plan); return { reused: true }; }
    requireCondition(target.empty && extra.empty, "CONFLICTING_OR_PARTIAL_TARGET_REFUSED");
  } else {
    requireCondition(original && ![...names].some((name) => name.startsWith("legacy_")), "PARTIAL_RENAME_REQUIRES_REVIEW");
    requireCondition(names.size === ORIGINAL_COLLECTIONS.length, "UNEXPECTED_COLLECTIONS");
    await checkSource(db, plan, "");
    for (const name of ORIGINAL_COLLECTIONS) await db.collection(name).rename(`legacy_${name}`, { dropTarget: false });
    await checkSource(db, plan, "legacy_");
  }
  // Metadata/index setup is outside the transaction; only new collections.
  for (const name of [...Object.keys(plan.migration.targets), ...Object.keys(plan.ancillary)]) {
    const exists = await db.listCollections({ name }, { nameOnly: true }).hasNext();
    if (!exists) await db.createCollection(name);
  }
  await createAncillaryIndexes(db, plan);
  await populateMigrationTargets(client, db, plan.migration, plan.ancillary);
  await verifyPhase8(db, plan); return { reused: false };
}
export async function verifyPhase8(db: Db, plan: Phase8Plan) {
  validatePhase8Plan(plan); requireCondition(db.databaseName === "switchplay", "UNEXPECTED_PRODUCTION_DATABASE");
  const names = (await db.listCollections({}, { nameOnly: true }).toArray()).map(({ name }) => name).sort();
  const expectedNames = [...ORIGINAL_COLLECTIONS.map((name) => `legacy_${name}`), ...Object.keys(plan.migration.targets), ...Object.keys(plan.ancillary)].sort();
  requireCondition(fingerprint(names) === fingerprint(expectedNames), "UNEXPECTED_COLLECTIONS");
  await checkSource(db, plan, "legacy_");
  requireCondition((await inspectTargets(db, plan.migration)).exact && (await inspectAncillary(db, plan)).exact, "POST_APPLY_TARGET_DRIFT");
  // Check the actual installed definitions, not merely expected document counts.
  const expected = [
    ["cardTemplates", { cardTemplateId: 1 }, true], ["cardTemplates", { stepIds: 1 }, true],
    ["cardTemplateVersions", { cardTemplateId: 1, version: 1 }, true], ["deckTemplates", { deckTemplateId: 1 }, true],
    ["deckTemplateVersions", { deckTemplateId: 1, version: 1 }, true],
    ["cardTemplates", { ownerUserId: 1, cardTemplateId: 1 }, false],
    ["deckTemplates", { ownerUserId: 1, deckTemplateId: 1 }, false],
    ["deckTemplates", { visibility: 1, latestVersion: 1, deckTemplateId: 1 }, false],
    ["deckTemplates", { "draft.cards.cardTemplateId": 1, deckTemplateId: 1 }, false],
    ["deckTemplateVersions", { "content.cards.cardTemplateId": 1, deckTemplateId: 1 }, false],
  ] as const;
  for (const [name, key, unique] of expected) requireCondition((await db.collection(name).indexes()).some((index) => fingerprint(index.key) === fingerprint(key) && Boolean(index.unique) === unique
    && (name !== "cardTemplates" || !("stepIds" in key) || fingerprint(index.partialFilterExpression) === fingerprint({ "stepIds.0": { $exists: true } }))), "MISSING_REQUIRED_INDEX");
  return { valid: true, legacyCounts: plan.counts, migratedCounts: plan.migration.counts, backupRestoreVerified: false };
}

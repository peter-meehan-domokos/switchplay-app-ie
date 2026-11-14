import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { Db, IndexDescription, MongoClient } from "mongodb";
import { getDatabase, getMongoClient } from "../src/lib/mongodb";

const simple = { locale: "simple" };
const notificationIndexes: IndexDescription[] = [
  { key: { createdAt: 1 }, name: "created_at" },
  { key: { "founderNotification.status": 1, createdAt: 1 }, name: "notification_status_created" },
];
export const MEMBERSHIP_INDEXES: Record<string, IndexDescription[]> = {
  users: [
    { key: { email: 1 }, name: "membership_unique_email", unique: true, collation: simple },
    { key: { username: 1 }, name: "membership_unique_username", unique: true, collation: simple },
  ],
  puckleMemberships: [{ key: { userId: 1 }, name: "membership_unique_user", unique: true }, ...notificationIndexes],
  puckleJoinContactRequests: notificationIndexes,
  puckleInterestContacts: notificationIndexes,
  puckleTuitionEnquiries: notificationIndexes,
  accountEmailChallenges: [
    { key: { challengeId: 1 }, name: "unique_challenge", unique: true },
    { key: { cleanupAt: 1 }, name: "challenge_cleanup", expireAfterSeconds: 0 },
  ],
  accountEmailActions: [
    { key: { tokenDigest: 1 }, name: "unique_action_token", unique: true },
    { key: { cleanupAt: 1 }, name: "action_cleanup", expireAfterSeconds: 0 },
  ],
  emailRequestLimits: [{ key: { expiresAt: 1 }, name: "limit_cleanup", expireAfterSeconds: 0 }],
};
/** Explicit DDL only. No user/profile population, repairs, drops or import-time connection. */
export async function preparePuckleMembership(db: Db) {
  const collections = await db.listCollections({}, { nameOnly: false }).toArray();
  // Read-only preflight of existing identities; never print them in a diagnostic.
  for await (const user of db.collection("users").find({}, { projection: { email: 1, username: 1 } })) {
    if (typeof user.email !== "string" || !user.email || user.email !== user.email.trim().toLowerCase()
      || typeof user.username !== "string" || !user.username) throw new Error("UNEXPECTED_ACCOUNT_IDENTITY_FORMAT");
  }
  const additions: { collection: string; index: IndexDescription }[] = [];
  for (const [collection, indexes] of Object.entries(MEMBERSHIP_INDEXES)) {
    const info = collections.find(entry => entry.name === collection);
    if (info && info.type !== "collection") throw new Error(`UNEXPECTED_COLLECTION_TYPE:${collection}`);
    if (info?.options?.collation && info.options.collation.locale !== "simple") throw new Error(`UNEXPECTED_COLLECTION_COLLATION:${collection}`);
    const existing = info ? await db.collection(collection).listIndexes().toArray() : [];
    for (const index of indexes) {
      const sameKey = existing.find(entry => JSON.stringify(entry.key) === JSON.stringify(index.key));
      if (sameKey) {
        if (!!sameKey.unique !== !!index.unique || sameKey.expireAfterSeconds !== index.expireAfterSeconds
          || sameKey.sparse || sameKey.partialFilterExpression || sameKey.hidden
          || (sameKey.collation && sameKey.collation.locale !== "simple")) throw new Error(`CONFLICTING_MEMBERSHIP_INDEX:${collection}:${index.name}`);
      } else {
        if (existing.some(entry => entry.name === index.name)) throw new Error(`CONFLICTING_MEMBERSHIP_INDEX_NAME:${collection}:${index.name}`);
        additions.push({ collection, index });
      }
      if (index.unique && info) {
        const key = Object.keys(index.key)[0];
        const duplicate = await db.collection(collection).aggregate([
          { $group: { _id: `$${key}`, count: { $sum: 1 } } }, { $match: { count: { $gt: 1 } } }, { $limit: 1 },
        ], { collation: simple }).hasNext();
        if (duplicate) throw new Error(`DUPLICATE_MEMBERSHIP_INDEX_VALUES:${collection}:${index.name}`);
        if (collection === "puckleMemberships" && await db.collection(collection).findOne({ userId: { $not: { $type: "objectId" } } })) throw new Error("INVALID_MEMBERSHIP_USER_ID");
      }
    }
  }
  for (const collection of Object.keys(MEMBERSHIP_INDEXES)) {
    if (!collections.some(entry => entry.name === collection)) {
      try { await db.createCollection(collection); }
      catch (error) { if (!(error && typeof error === "object" && "code" in error && error.code === 48)) throw error; }
    }
  }
  for (const { collection, index } of additions) await db.collection(collection).createIndexes([index]);
  return { collections: Object.keys(MEMBERSHIP_INDEXES), indexesAdded: additions.length };
}
export async function main(args = process.argv.slice(2)) {
  if (args.length === 1 && args[0] === "--help") { console.log("--apply [--confirm-live switchplay]. Explicit DDL only; no env files loaded. Live execution requires separate approval."); return 0; }
  const live = process.env.SWITCHPLAY_DATABASE_MODE === "production";
  if (JSON.stringify(args) !== JSON.stringify(live ? ["--apply", "--confirm-live", "switchplay"] : ["--apply"])) {
    console.error("EXPLICIT_PREPARATION_ARGUMENTS_REQUIRED"); return 1;
  }
  let client: MongoClient | undefined;
  try { client = await getMongoClient(); console.log(JSON.stringify(await preparePuckleMembership(await getDatabase()))); return 0; }
  catch (error) {
    const diagnostic = error instanceof Error && /^[A-Z_]+(?::[a-zA-Z0-9_]+){0,2}$/.test(error.message) ? error.message : "DATABASE_DDL_FAILED";
    console.error(`MEMBERSHIP_PREPARATION_FAILED:${diagnostic}. Inspect data/index definitions; no records were repaired or deleted.`); return 1;
  }
  finally { await client?.close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) void main().then(code => { process.exitCode = code; });

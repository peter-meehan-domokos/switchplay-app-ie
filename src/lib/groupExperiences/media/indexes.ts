import type { Db, IndexDescription } from "mongodb";
import { requireCondition } from "../../cards/domain";
export const GROUP_MEDIA_COLLECTION = "groupMediaContributions";
export const GROUP_MEDIA_INDEXES: IndexDescription[] = [
  { key: { contributionId: 1 }, name: "group_media_identity", unique: true },
  { key: { authorUserId: 1, operationId: 1 }, name: "group_media_operation", unique: true },
  { key: { "asset.provider": 1, "asset.assetId": 1 }, name: "group_media_asset", unique: true, partialFilterExpression: { "asset.assetId": { $type: "string" } } },
  { key: { authorUserId: 1, cardTemplateId: 1, state: 1, uploadedAt: -1, contributionId: -1 }, name: "group_media_owner_history" },
  { key: { experienceId: 1, cardTemplateId: 1, state: 1, groupVisible: 1, uploadedAt: -1, contributionId: -1 }, name: "group_media_shared_history" },
];
// Explicit provisioning; requests never create indexes or silently provision a DB.
export async function createGroupMediaIndexes(db: Db) { await db.collection(GROUP_MEDIA_COLLECTION).createIndexes(GROUP_MEDIA_INDEXES); }
export async function assertGroupMediaIndexes(db: Db) {
  requireCondition(await db.listCollections({ name: GROUP_MEDIA_COLLECTION }, { nameOnly: true }).hasNext(), "GROUP_MEDIA_INDEXES_NOT_READY");
  const actual = await db.collection(GROUP_MEDIA_COLLECTION).listIndexes().toArray();
  for (const expected of GROUP_MEDIA_INDEXES) requireCondition(actual.some(i => i.name === expected.name
    && JSON.stringify(i.key) === JSON.stringify(expected.key) && Boolean(i.unique) === Boolean(expected.unique)
    && !i.sparse && JSON.stringify(i.partialFilterExpression) === JSON.stringify(expected.partialFilterExpression)), "GROUP_MEDIA_INDEXES_NOT_READY");
}

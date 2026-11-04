import { createGroupReflectionIndexes } from "../reflections/indexes";
import { createGroupMediaIndexes } from "./media/indexes";
import type { Db, IndexDescription } from "mongodb";
import { requireCondition } from "../cards/domain";

export const GROUP_COLLECTIONS = { experiences: "groupExperiences", members: "groupExperienceMembers",
  cardData: "groupCardData", receipts: "groupOperationReceipts", removals: "groupRemovalLearning" } as const;
const definitions: [string, IndexDescription][] = [
  [GROUP_COLLECTIONS.experiences, { key: { experienceId: 1 }, name: "group_identity", unique: true }],
  [GROUP_COLLECTIONS.experiences, { key: { creatorUserId: 1, operationId: 1 }, name: "group_create_receipt", unique: true }],
  [GROUP_COLLECTIONS.members, { key: { experienceId: 1, userId: 1 }, name: "group_member_identity", unique: true }],
  [GROUP_COLLECTIONS.members, { key: { userId: 1, isAdmin: 1, experienceId: 1 }, name: "group_admin_entries" }],
  [GROUP_COLLECTIONS.members, { key: { userId: 1, followerStatus: 1, experienceId: 1 }, name: "group_assignments" }],
  [GROUP_COLLECTIONS.members, { key: { experienceId: 1, followerStatus: 1, userId: 1 }, name: "group_roster" }],
  [GROUP_COLLECTIONS.cardData, { key: { experienceId: 1, cardTemplateId: 1 }, name: "group_learning_identity", unique: true }],
  [GROUP_COLLECTIONS.receipts, { key: { experienceId: 1, actor: 1, operationId: 1 }, name: "group_operation_identity", unique: true }],
  [GROUP_COLLECTIONS.removals, { key: { experienceId: 1, userId: 1, cardTemplateId: 1 }, name: "group_removal_identity", unique: true }],
];
// Explicit provisioning only. No route/module import creates collections or indexes.
export async function createGroupExperienceIndexes(db: Db) {
  // Provisioning must not create a parallel empty namespace beside legacy data.
  // The explicit offline migration, never an application request, owns cutover.
  requireCondition(!await db.listCollections({ name: "groupCardState" }, { nameOnly: true }).hasNext(), "GROUP_CARD_RENAME_REQUIRED");
  for (const [collection, definition] of definitions) await db.collection(collection).createIndexes([definition]);
  await createGroupMediaIndexes(db);
  await createGroupReflectionIndexes(db);
}
export async function assertGroupExperienceIndexes(db: Db) {
  requireCondition(!await db.listCollections({ name: "groupCardState" }, { nameOnly: true }).hasNext(), "GROUP_CARD_RENAME_REQUIRED");
  for (const collection of new Set(definitions.map(([name]) => name))) {
    const exists = await db.listCollections({ name: collection }, { nameOnly: true }).hasNext();
    requireCondition(exists, "GROUP_INDEXES_NOT_READY");
    const indexes = await db.collection(collection).listIndexes().toArray();
    for (const [, expected] of definitions.filter(([name]) => name === collection)) {
      requireCondition(indexes.some(index => index.name === expected.name && Boolean(index.unique) === Boolean(expected.unique)
        && !index.sparse && !index.partialFilterExpression && JSON.stringify(index.key) === JSON.stringify(expected.key)), "GROUP_INDEXES_NOT_READY");
    }
  }
}

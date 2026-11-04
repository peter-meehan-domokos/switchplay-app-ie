import type { Db, IndexDescription } from "mongodb";
import { requireCondition } from "../cards/domain";
export const GROUP_REFLECTIONS = "groupReflections";
export const GROUP_REFLECTION_INDEXES: IndexDescription[] = [
  { name: "group_reflection_identity", key: { reflectionId: 1 }, unique: true },
  { name: "group_reflection_slot", key: { experienceId: 1, cardTemplateId: 1, authorUserId: 1 }, unique: true },
  { name: "group_reflection_owner_history", key: { authorUserId: 1, cardTemplateId: 1, createdAt: -1, reflectionId: 1 } },
  { name: "group_reflection_shared_history", key: { experienceId: 1, cardTemplateId: 1, groupVisible: 1, createdAt: -1, authorUserId: 1, reflectionId: 1 } },
];
// Explicit provisioning only. Request paths never create indexes or databases.
export async function createGroupReflectionIndexes(db: Db) { await db.collection(GROUP_REFLECTIONS).createIndexes(GROUP_REFLECTION_INDEXES); }
export async function assertGroupReflectionIndexes(db: Db) {
  requireCondition(await db.listCollections({ name: GROUP_REFLECTIONS }, { nameOnly: true }).hasNext(), "REFLECTION_INDEXES_NOT_READY");
  const actual = await db.collection(GROUP_REFLECTIONS).listIndexes().toArray();
  for (const index of GROUP_REFLECTION_INDEXES) requireCondition(actual.some(i => i.name === index.name && JSON.stringify(i.key) === JSON.stringify(index.key)
    && Boolean(i.unique) === Boolean(index.unique) && !i.sparse && !i.partialFilterExpression), "REFLECTION_INDEXES_NOT_READY");
}

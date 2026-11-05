import { MongoServerError, type ClientSession } from "mongodb";
import type { GroupExperienceRepository } from "../groupExperiences/repository";
import { exact, hash, id, revision } from "../groupExperiences/contracts";
import { requireCondition } from "../cards/domain";
import { selectedCard } from "../groupExperiences/publicVersions";
import type { CollectiveReflection } from "./model";

// Internal reader: caller already established current Group/Card authority in
// this transaction. Do not widen existing scalar/assessment projections.
export async function collectiveReflection(groups: GroupExperienceRepository, experienceId: string, cardTemplateId: string, isAdmin: boolean, session: ClientSession): Promise<CollectiveReflection> {
  const row = await groups.cardData().findOne({ experienceId, cardTemplateId }, { session, projection: { _id: 0, reflection: 1, reflectionRevision: 1 } });
  const text = row?.reflection === undefined ? "" : row.reflection, value = row?.reflectionRevision ?? 0;
  requireCondition(typeof text === "string" && text.length <= 20000 && row?.reflectionRevision !== null, "INVALID_COLLECTIVE_REFLECTION"); revision(value);
  return { source: { kind: "group-card", experienceId, cardTemplateId }, text, revision: value, canEdit: isAdmin };
}
export async function saveCollectiveReflection(groups: GroupExperienceRepository, actor: string, experienceId: string, cardTemplateId: string, input: unknown) {
  id(actor); id(experienceId); id(cardTemplateId);
  exact(input, ["operationId", "expectedRevision", "accessEpoch", "text"]);
  id(input.operationId); revision(input.expectedRevision); revision(input.accessEpoch);
  requireCondition(typeof input.text === "string" && input.text.length <= 20000, "INVALID_REFLECTION_TEXT");
  const cmd = { operationId: input.operationId, expectedRevision: input.expectedRevision, accessEpoch: input.accessEpoch, text: input.text.trim() }, now = new Date();
  const commandHash = hash({ actor, experienceId, cardTemplateId, kind: "collective-reflection", ...cmd });
  const run = () => groups.transaction(async session => {
    const { member, experience } = await groups.access(actor, experienceId, "admin", session, cmd.accessEpoch);
    await selectedCard(groups.cards, experience, cardTemplateId, session);
    const admins = await groups.members().find({ experienceId, isAdmin: true }, { session }).toArray();
    await groups.fence([member, ...admins], session);
    const row = await groups.cardData().findOne({ experienceId, cardTemplateId }, { session, projection: { _id: 0, reflection: 1, reflectionRevision: 1, reflectionLastOperation: 1 } });
    requireCondition(row?.reflection === undefined || typeof row.reflection === "string", "INVALID_COLLECTIVE_REFLECTION");
    const value = row?.reflectionRevision === undefined ? 0 : row.reflectionRevision; revision(value);
    if (row?.reflectionLastOperation?.operationId === cmd.operationId && row.reflectionLastOperation.actorUserId === actor) {
      requireCondition(row.reflectionLastOperation.commandHash === commandHash, "REFLECTION_OPERATION_CONFLICT");
      return { revision: value, outcome: "already-applied" as const };
    }
    requireCondition(value === cmd.expectedRevision, "REFLECTION_REVISION_CONFLICT");
    if (!row && !cmd.text) return { revision: 0, outcome: "unchanged" as const };
    const reflectionLastOperation = { actorUserId: actor, operationId: cmd.operationId, commandHash };
    if (!row) await groups.cardData().insertOne({ experienceId, cardTemplateId, items: [], signalReadings: [], revision: 0,
      reflection: cmd.text, reflectionRevision: 1, reflectionLastOperation, createdAt: now, updatedAt: now }, { session });
    else {
      const guard = cmd.expectedRevision === 0 ? { $or: [{ reflectionRevision: 0 }, { reflectionRevision: { $exists: false } }] } : { reflectionRevision: cmd.expectedRevision };
      const result = await groups.cardData().updateOne({ experienceId, cardTemplateId, ...guard }, { $set: {
        reflection: cmd.text, reflectionRevision: value + 1, reflectionLastOperation, updatedAt: now,
      } }, { session });
      requireCondition(result.matchedCount === 1, "REFLECTION_REVISION_CONFLICT");
    }
    return { revision: value + 1, outcome: "applied" as const };
  });
  try { return await run(); } catch (error) { if (!(error instanceof MongoServerError && error.code === 11000)) throw error; return run(); }
}

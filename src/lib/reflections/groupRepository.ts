import { randomUUID } from "node:crypto";
import { MongoServerError, type ClientSession } from "mongodb";
import { requireCondition } from "../cards/domain";
import { exact, hash, id, revision } from "../groupExperiences/contracts";
import type { GroupExperienceRepository } from "../groupExperiences/repository";
import { selectedCard } from "../groupExperiences/publicVersions";
import { GROUP_REFLECTIONS, assertGroupReflectionIndexes } from "./indexes";
import type { GroupReflection } from "./model";

type Ack = { reflectionId: string | null; revision: number; outcome: "applied" | "already-applied" | "unchanged" };
function command(value: unknown, kind: "save" | "hide" | "delete") {
  exact(value, ["operationId", "expectedRevision", ...(kind === "save" ? ["text", "accessEpoch", "reflectionId"] : kind === "hide" ? ["accessEpoch"] : [])]);
  id(value.operationId); revision(value.expectedRevision);
  if (kind !== "delete") revision(value.accessEpoch);
  if (kind === "save") {
    requireCondition(typeof value.text === "string" && value.text.length <= 20000, "INVALID_REFLECTION_TEXT");
    if (value.reflectionId != null) id(value.reflectionId);
  }
  return value as { operationId: string; expectedRevision: number; text?: string; accessEpoch?: number; reflectionId?: string | null };
}

export class GroupReflectionRepository {
  private ready = false;
  constructor(readonly groups: GroupExperienceRepository) {}
  rows() { return this.groups.cards.db.collection<GroupReflection>(GROUP_REFLECTIONS); }
  private async transaction<T>(run: (session: ClientSession) => Promise<T>) {
    if (!this.ready) { await assertGroupReflectionIndexes(this.groups.cards.db); this.ready = true; }
    return this.groups.transaction(run);
  }
  private replay(row: Pick<GroupReflection, "reflectionId" | "revision" | "lastOperation">, actor: string, operationId: string, commandHash: string): Ack | null {
    if (row.lastOperation?.actorUserId !== actor || row.lastOperation.operationId !== operationId) return null;
    requireCondition(row.lastOperation.commandHash === commandHash, "REFLECTION_OPERATION_CONFLICT");
    return { reflectionId: row.reflectionId, revision: row.revision, outcome: "already-applied" };
  }
  async save(actor: string, experienceId: string, cardTemplateId: string, input: unknown): Promise<Ack> {
    id(actor); id(experienceId); id(cardTemplateId);
    const cmd = command(input, "save"), text = cmd.text!.trim(), now = new Date(), reflectionId = randomUUID();
    const commandHash = hash({ kind: "save-reflection", actor, experienceId, cardTemplateId, ...cmd, text });
    const run = (): Promise<Ack> => this.transaction<Ack>(async session => {
      const { member, experience } = await this.groups.access(actor, experienceId, "member", session, cmd.accessEpoch);
      await selectedCard(this.groups.cards, experience, cardTemplateId, session);
      // Same adoption fence as Group media creation: a concurrent composition
      // change cannot validate a reflection edit against removed content.
      const admins = await this.groups.members().find({ experienceId, isAdmin: true }, { session }).toArray();
      await this.groups.fence([member, ...admins], session);
      const row = await this.rows().findOne({ experienceId, cardTemplateId, authorUserId: actor }, { session });
      if (row) {
        requireCondition(cmd.reflectionId == null || cmd.reflectionId === row.reflectionId, "REFLECTION_SOURCE_FORBIDDEN");
        const replay = this.replay(row, actor, cmd.operationId, commandHash); if (replay) return replay;
      } else requireCondition(cmd.reflectionId == null, "REFLECTION_SOURCE_FORBIDDEN");
      requireCondition((row?.revision ?? 0) === cmd.expectedRevision, "REFLECTION_REVISION_CONFLICT");
      if (!row && !text) return { reflectionId: null, revision: 0, outcome: "unchanged" };
      const lastOperation = { operationId: cmd.operationId, actorUserId: actor, commandHash };
      if (!row) {
        await this.rows().insertOne({ reflectionId, experienceId, cardTemplateId, authorUserId: actor, text,
          groupVisible: true, deleted: false, revision: 1, createdAt: now, updatedAt: now, lastOperation }, { session });
        return { reflectionId, revision: 1, outcome: "applied" };
      }
      const result = await this.rows().updateOne({ reflectionId: row.reflectionId, revision: cmd.expectedRevision }, {
        $set: { text, deleted: false, updatedAt: now, lastOperation }, $inc: { revision: 1 },
      }, { session });
      requireCondition(result.matchedCount === 1, "REFLECTION_REVISION_CONFLICT");
      return { reflectionId: row.reflectionId, revision: row.revision + 1, outcome: "applied" };
    });
    try { return await run(); }
    catch (error) { if (!(error instanceof MongoServerError && error.code === 11000)) throw error; return run(); }
  }
  async hide(actor: string, experienceId: string, reflectionId: string, input: unknown): Promise<Ack> {
    id(actor); id(experienceId); id(reflectionId); const cmd = command(input, "hide"), now = new Date();
    const commandHash = hash({ kind: "hide-reflection", actor, experienceId, reflectionId, ...cmd });
    return this.transaction(async session => {
      const { member } = await this.groups.access(actor, experienceId, "admin", session, cmd.accessEpoch);
      await this.groups.fence([member], session);
      const row = await this.rows().findOne({ reflectionId, experienceId, deleted: false }, { session, projection: { _id: 0, reflectionId: 1, revision: 1, lastOperation: 1 } });
      requireCondition(row, "REFLECTION_SOURCE_FORBIDDEN");
      const replay = this.replay(row, actor, cmd.operationId, commandHash); if (replay) return replay;
      requireCondition(row.revision === cmd.expectedRevision, "REFLECTION_REVISION_CONFLICT");
      const result = await this.rows().updateOne({ reflectionId, revision: row.revision }, { $set: { groupVisible: false, updatedAt: now,
        lastOperation: { operationId: cmd.operationId, actorUserId: actor, commandHash } }, $inc: { revision: 1 } }, { session });
      requireCondition(result.matchedCount === 1, "REFLECTION_REVISION_CONFLICT");
      return { reflectionId, revision: row.revision + 1, outcome: "applied" };
    });
  }
  async deleteOwn(actor: string, reflectionId: string, input: unknown): Promise<Ack> {
    id(actor); id(reflectionId); const cmd = command(input, "delete"), now = new Date();
    const commandHash = hash({ kind: "delete-own-reflection", actor, reflectionId, ...cmd });
    return this.transaction(async session => {
      const row = await this.rows().findOne({ reflectionId, authorUserId: actor }, { session });
      requireCondition(row, "REFLECTION_SOURCE_FORBIDDEN");
      const replay = this.replay(row, actor, cmd.operationId, commandHash); if (replay) return replay;
      requireCondition(row.revision === cmd.expectedRevision, "REFLECTION_REVISION_CONFLICT");
      // Deletion is independent of the visibility flag. Preserve a prior Admin
      // hide through any later authorised re-authoring of this same slot.
      const result = await this.rows().updateOne({ reflectionId, revision: row.revision }, { $set: { text: "", deleted: true, updatedAt: now,
        lastOperation: { operationId: cmd.operationId, actorUserId: actor, commandHash } }, $inc: { revision: 1 } }, { session });
      requireCondition(result.matchedCount === 1, "REFLECTION_REVISION_CONFLICT");
      return { reflectionId, revision: row.revision + 1, outcome: "applied" };
    });
  }
}

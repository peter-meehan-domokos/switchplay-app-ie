import { exact, id, revision, hash } from "./contracts";
import { requireCondition } from "../cards/domain";
import type { GroupExperienceRepository } from "./repository";
import type { GroupPreparationSelection, PerspectiveSelection } from "./model";
import { assertSelection, canSelect, defaultPerspective } from "./policy";
import type { ClientSession } from "mongodb";
import type { GroupExperience, GroupMember } from "./model";

export function selectionCommand(value: unknown): PerspectiveSelection {
  exact(value, ["perspective", "subjectUserId"]);
  requireCondition(["group", "self", "follower"].includes(String(value.perspective)), "INVALID_GROUP_PERSPECTIVE");
  if (value.perspective === "follower") id(value.subjectUserId);
  else requireCondition(value.subjectUserId === undefined, "INVALID_GROUP_SUBJECT");
  return value as PerspectiveSelection;
}
export function preparationSelectionCommand(value: unknown): GroupPreparationSelection {
  if (value && typeof value === "object" && "perspective" in value && value.perspective === "default") {
    exact(value, ["perspective"]);
    return { perspective: "default" };
  }
  return selectionCommand(value);
}
export async function restoredPerspective(repo: GroupExperienceRepository, experience: GroupExperience, member: GroupMember, session: ClientSession) {
  const selected = member.lastPerspective;
  const subject = selected?.perspective === "follower" ? await repo.members().findOne({ experienceId: experience.experienceId, userId: selected.subjectUserId }, { session }) : null;
  return selected && canSelect(experience, member, selected, subject) ? selected : defaultPerspective(member);
}
export async function saveNavigation(repo: GroupExperienceRepository, actor: string, experienceId: string, value: unknown) {
  exact(value, ["accessEpoch", "expectedStructureRevision", "activeCardId", "selection"]);
  revision(value.accessEpoch); revision(value.expectedStructureRevision);
  requireCondition(value.activeCardId !== undefined || value.selection !== undefined, "INVALID_GROUP_NAVIGATION");
  if (value.activeCardId !== undefined) id(value.activeCardId);
  const selection = value.selection === undefined ? undefined : selectionCommand(value.selection);
  return repo.transaction(async session => {
    const { experience, member } = await repo.access(actor, experienceId, "member", session, value.accessEpoch as number);
    requireCondition(experience.structureRevision === value.expectedStructureRevision, "GROUP_STRUCTURE_CONFLICT");
    const subject = selection?.perspective === "follower" ? await repo.members().findOne({ experienceId, userId: selection.subjectUserId }, { session }) : null;
    if (selection) assertSelection(experience, member, selection, subject);
    if (value.activeCardId !== undefined) {
      const { selectedCard } = await import("./publicVersions");
      await selectedCard(repo.cards, experience, value.activeCardId as string, session);
    }
    // Fence a peer selection against removal, and the actor against revocation.
    await repo.fence(subject ? [member, subject] : [member], session);
    await repo.members().updateOne({ experienceId, userId: actor }, { $set: {
      ...(selection ? { lastPerspective: selection } : {}), ...(value.activeCardId ? { activeCardId: value.activeCardId as string } : {}),
    } }, { session });
    return { viewerUserId: actor, experienceId, ok: true };
  });
}
export async function saveSettings(repo: GroupExperienceRepository, actor: string, experienceId: string, value: unknown) {
  exact(value, ["operationId", "expectedStructureRevision", "allowFollowerInspection"]);
  id(value.operationId); revision(value.expectedStructureRevision);
  requireCondition(typeof value.allowFollowerInspection === "boolean", "INVALID_GROUP_POLICY");
  const commandHash = hash(value), now = new Date();
  return repo.transaction(async session => {
    const { experience, member } = await repo.access(actor, experienceId, "admin", session);
    const replay = await repo.replay(actor, experience, value.operationId as string, commandHash, session); if (replay) return replay;
    requireCondition(experience.structureRevision === value.expectedStructureRevision, "GROUP_STRUCTURE_CONFLICT");
    const followers = await repo.members().find({ experienceId, followerStatus: "active" }, { session }).toArray();
    // Policy changes serialize with follower requests through existing member
    // fences; ordinary navigation never writes an experience-wide lock.
    await repo.fence([member, ...followers], session);
    const result = await repo.experiences().updateOne({ experienceId, structureRevision: experience.structureRevision }, {
      $set: { allowFollowerInspection: value.allowFollowerInspection as boolean, updatedAt: now }, $inc: { structureRevision: 1 },
    }, { session });
    requireCondition(result.matchedCount === 1, "GROUP_STRUCTURE_CONFLICT");
    await repo.record(actor, experienceId, value.operationId as string, commandHash, experience.structureRevision + 1, now, session);
    return { viewerUserId: actor, experienceId, structureRevision: experience.structureRevision + 1, outcome: "applied" };
  });
}

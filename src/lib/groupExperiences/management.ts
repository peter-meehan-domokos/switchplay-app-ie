import { randomUUID } from "node:crypto";
import { requireCondition } from "../cards/domain";
import { mergeRetainedAssignments } from "../cards/retainedAssignments";
import { managementCommand, hash, id } from "./contracts";
import { snapshotRemoval } from "./lifecycle";
import { selectedContent } from "./publicVersions";
import type { GroupExperienceRepository } from "./repository";

// A form Save owns exactly one transaction. Never invoke the public member or
// settings commands here: those start independent transactions. Only scalar
// roles change; personal CardData and retained historical memberships survive.
export async function manageExperience(repo: GroupExperienceRepository, actor: string, experienceId: string, input: unknown) {
  id(actor); id(experienceId);
  const command = managementCommand(input), commandHash = hash({ kind: "management", ...command });
  const now = new Date(), generation = randomUUID();
  return repo.transaction(async session => {
    const receipt = await repo.receipts().findOne({ experienceId, actor, operationId: command.operationId }, { session });
    if (receipt) {
      requireCondition(receipt.commandHash === commandHash, "GROUP_OPERATION_CONFLICT");
      const current = await repo.members().findOne({ experienceId, userId: actor }, { session });
      // Authentication still runs at HTTP entry. Only this actor's exact
      // committed command is acknowledged after self-removal, with no content,
      // roles, or renewed permission returned from the inaccessible Group.
      return { viewerUserId: actor, experienceId, structureRevision: receipt.structureRevision, outcome: "already-applied" as const,
        hasAccess: Boolean(current && (current.isAdmin || current.followerStatus === "active")) };
    }
    const { experience, member } = await repo.access(actor, experienceId, "admin", session);
    requireCondition(experience.structureRevision === command.expectedStructureRevision, "GROUP_STRUCTURE_CONFLICT");
    requireCondition(command.adminIds.length > 0, "GROUP_FINAL_ADMIN_CONFLICT");
    const users = [...new Set([...command.adminIds, ...command.followerIds])].sort();
    await repo.registered(users, session);
    const existing = await repo.members().find({ experienceId }, { session }).toArray();
    const policyChanged = (experience.allowFollowerInspection === true) !== command.allowFollowerInspection;
    const changed = [...new Set([...users, ...existing.filter(row => row.isAdmin || row.followerStatus === "active").map(row => row.userId)])]
      .sort().filter(userId => {
        const row = existing.find(row => row.userId === userId);
        return Boolean(row?.isAdmin) !== command.adminIds.includes(userId)
          || (row?.followerStatus === "active") !== command.followerIds.includes(userId);
      });
    await repo.fence([member, ...existing.filter(row => changed.includes(row.userId) || policyChanged && row.followerStatus === "active")], session);
    const cards = changed.length ? (await selectedContent(repo.cards, experience, session)).cards : [];
    const refs = cards.map(({ cardTemplateId, version }) => ({ cardTemplateId, version }));
    for (const userId of changed) {
      const prior = existing.find(row => row.userId === userId);
      const admin = command.adminIds.includes(userId), follower = command.followerIds.includes(userId);
      if (!prior) {
        await repo.members().insertOne(repo.newMember(experienceId, userId, admin, follower, refs, now), { session });
        continue;
      }
      const next = { ...prior, isAdmin: admin };
      if (follower && prior.followerStatus !== "active") {
        next.followerStatus = "active"; next.joinedAt ??= now; next.removedAt = null;
        if (prior.followerStatus === "removed") next.rejoinedAt = now;
        next.retainedCardAssignments = mergeRetainedAssignments(prior.retainedCardAssignments, refs);
      } else if (!follower && prior.followerStatus === "active") {
        next.latestRemoval = await snapshotRemoval(repo, experience, prior, cards, generation, now, session);
        next.followerStatus = "removed"; next.removedAt = now; next.activeCardId = null;
        next.retainedCardAssignments = mergeRetainedAssignments(prior.retainedCardAssignments, refs);
      }
      await repo.members().updateOne({ experienceId, userId, accessEpoch: prior.accessEpoch }, { $set: {
        isAdmin: next.isAdmin, followerStatus: next.followerStatus, joinedAt: next.joinedAt, removedAt: next.removedAt,
        rejoinedAt: next.rejoinedAt ?? null, activeCardId: next.activeCardId, retainedCardAssignments: next.retainedCardAssignments,
        ...(next.latestRemoval ? { latestRemoval: next.latestRemoval } : {}),
      }, $inc: { accessEpoch: 1 } }, { session });
    }
    const structureRevision = experience.structureRevision + 1;
    const update = await repo.experiences().updateOne({ experienceId, structureRevision: command.expectedStructureRevision }, {
      $set: { name: command.name, allowFollowerInspection: command.allowFollowerInspection, adminCount: command.adminIds.length, updatedAt: now },
      $inc: { structureRevision: 1 },
    }, { session });
    requireCondition(update.matchedCount === 1, "GROUP_STRUCTURE_CONFLICT");
    await repo.record(actor, experienceId, command.operationId, commandHash, structureRevision, now, session);
    return { viewerUserId: actor, experienceId, structureRevision, outcome: "applied" as const,
      hasAccess: command.adminIds.includes(actor) || command.followerIds.includes(actor) };
  });
}

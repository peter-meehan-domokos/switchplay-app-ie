import type { ClientSession } from "mongodb";
import { requireCondition } from "../cards/domain";
import { projectLearning } from "../cards/learning";
import type { CardTemplateVersion } from "../cards/model";
import { personalLearningForUsers } from "./learningReads";
import { publicCards } from "./publicVersions";
import type { GroupExperienceRepository } from "./repository";
import type { GroupExperience, GroupMember, RemovalManifest } from "./model";
import { metrics } from "./readModels";

export async function snapshotRemoval(repo: GroupExperienceRepository, experience: GroupExperience, member: GroupMember,
  cards: CardTemplateVersion[], generation: string, now: Date, session: ClientSession): Promise<RemovalManifest> {
  const personal = (await personalLearningForUsers(repo.cards, [member.userId], cards, session)).get(member.userId)!;
  const manifest = { generation, snapshotAt: now, deckVersion: experience.deckVersion,
    cards: cards.map(({ cardTemplateId, version }) => ({ cardTemplateId, version })) };
  await repo.removals().deleteMany({ experienceId: experience.experienceId, userId: member.userId }, { session });
  if (personal.length) await repo.removals().insertMany(personal.map(card => ({ experienceId: experience.experienceId, userId: member.userId,
    cardTemplateId: card.cardTemplateId, version: card.version, items: card.items, signalReadings: card.signalReadings, generation, snapshotAt: now })), { session });
  return manifest;
}
export async function removalSnapshot(repo: GroupExperienceRepository, member: GroupMember, session: ClientSession) {
  requireCondition(member.followerStatus === "removed" && member.latestRemoval, "GROUP_SNAPSHOT_FORBIDDEN");
  const manifest = member.latestRemoval;
  requireCondition(typeof manifest.generation === "string" && manifest.snapshotAt instanceof Date && Array.isArray(manifest.cards), "INVALID_GROUP_SNAPSHOT");
  const versions = await publicCards(repo.cards, manifest.cards, session);
  const rows = await repo.removals().find({ experienceId: member.experienceId, userId: member.userId, generation: manifest.generation }, { session }).toArray();
  requireCondition(rows.length === versions.length, "INVALID_GROUP_SNAPSHOT");
  const learning = versions.map(version => {
    const matches = rows.filter(row => row.cardTemplateId === version.cardTemplateId && row.version === version.version);
    requireCondition(matches.length === 1 && matches[0].snapshotAt.getTime() === manifest.snapshotAt.getTime(), "INVALID_GROUP_SNAPSHOT");
    const row = matches[0];
    requireCondition(row.items.length === version.content.steps.length && row.signalReadings.length === version.content.steps.length
      && version.content.steps.every(step => row.items.some(item => item.stepId === step.stepId) && row.signalReadings.some(signal => signal.stepId === step.stepId)), "INVALID_GROUP_SNAPSHOT");
    return { cardTemplateId: version.cardTemplateId, version: version.version, ...projectLearning(version.content, row) };
  });
  return { manifest: { generation: manifest.generation, snapshotAt: manifest.snapshotAt, deckVersion: manifest.deckVersion,
    cards: manifest.cards.map(({ cardTemplateId, version }) => ({ cardTemplateId, version })) }, learning, metrics: metrics(learning) };
}
export async function formerCardLearning(repo: GroupExperienceRepository, member: GroupMember, current: CardTemplateVersion, session: ClientSession) {
  const snapshot = await removalSnapshot(repo, member, session), prior = snapshot.learning.find(card => card.cardTemplateId === current.cardTemplateId);
  return { cardTemplateId: current.cardTemplateId, version: current.version, state: "frozen" as const,
    sourceVersion: prior?.version ?? null, snapshotAt: snapshot.manifest.snapshotAt,
    items: current.content.steps.map(({ stepId }) => {
      const value = prior?.items.find(item => item.stepId === stepId);
      return { stepId, available: Boolean(value), completionStatus: value?.completionStatus ?? null };
    }), signalReadings: current.content.steps.map(({ stepId }) => {
      const value = prior?.signalReadings.find(signal => signal.stepId === stepId);
      return { stepId, available: Boolean(value), reading: value?.reading ?? null };
    }) };
}

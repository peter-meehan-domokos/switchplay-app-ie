import { getProgressPercentage } from "../progress";
import { getConfidenceScore } from "../signals";
import type { LearningFields } from "../cards/learning";
import type { GroupExperience, GroupMember } from "./model";
import type { LearningProjection } from "./learningReads";

export function metrics(cards: LearningFields[]) {
  return { completion: getProgressPercentage(cards.flatMap(card => card.items)),
    confidence: getConfidenceScore(cards.flatMap(card => card.signalReadings.map(signal => signal.reading))) };
}
export function followerMetrics(followers: LearningFields[][]) {
  return { completed: followers.filter(cards => metrics(cards).completion === 100).length, total: followers.length,
    confidence: getConfidenceScore(followers.flatMap(cards => cards.flatMap(card => card.signalReadings.map(signal => signal.reading)))) };
}
export function aggregateLearning(group: LearningProjection[], followers: LearningProjection[][]) {
  return { group: metrics(group), followers: followerMetrics(followers), cards: group.map((card, index) => ({
    cardTemplateId: card.cardTemplateId, version: card.version, group: metrics([card]),
    followers: followerMetrics(followers.map(cards => [cards[index]])),
    steps: card.items.map((item, step) => ({ stepId: item.stepId,
      group: metrics([{ items: [item], signalReadings: [card.signalReadings[step]] }]),
      followers: followerMetrics(followers.map(cards => [{ items: [cards[index].items[step]], signalReadings: [cards[index].signalReadings[step]] }])) })),
  })) };
}
export function identity(actor: string, experience: GroupExperience, member: GroupMember) {
  return { viewerUserId: actor, experienceId: experience.experienceId, structureRevision: experience.structureRevision,
    adoptionRevision: experience.adoptionRevision, accessEpoch: member.accessEpoch };
}
export function entry(actor: string, experience: GroupExperience, member: GroupMember) {
  return { ...identity(actor, experience, member), name: experience.name, deckTemplateId: experience.deckTemplateId,
    deckVersion: experience.deckVersion, isAdmin: member.isAdmin, isFollower: member.followerStatus === "active",
    activeCardId: member.activeCardId };
}

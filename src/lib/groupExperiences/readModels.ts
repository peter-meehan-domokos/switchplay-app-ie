import { classifyProgress, getProgressPercentage } from "../progress";
import { getConfidenceScore } from "../signals";
import type { LearningFields } from "../cards/learning";
import type { GroupExperience, GroupMember } from "./model";
import type { LearningProjection } from "./learningReads";

export function metrics(cards: LearningFields[]) {
  const steps = cards.flatMap(card => card.items);
  return { completion: classifyProgress(steps).eligibleCount ? getProgressPercentage(steps) : null,
    confidence: getConfidenceScore(cards.flatMap(card => card.signalReadings.map(signal => signal.reading))) };
}
export function followerMetrics(followers: LearningFields[][]) {
  // Count people from exact selected statuses, never rounded personal percentages.
  // All-skipped/empty scopes contribute no eligible progress observation. Raw
  // confidence is independent: a skipped Step may still have a valid reading.
  const classifications = followers.map(cards => classifyProgress(cards.flatMap(card => card.items)));
  return { activeTotal: followers.length, eligibleTotal: classifications.filter(value => value.eligibleCount > 0).length,
    doing: classifications.filter(value => value.status === "inProgress").length,
    done: classifications.filter(value => value.isComplete).length,
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

import { progressObservationState } from "@/lib/frameworks/progressState";
import type { LoadedGroup } from "./groupResource";
import type { PerspectiveSelection } from "@/lib/groupExperiences/model";
import { cardLearningContextKey } from "@/lib/cards/learningContext";
import { metrics } from "@/lib/groupExperiences/readModels";
import type { ExperienceDeckPresentation } from "@/components/decks/presentation";
import { requireCondition } from "@/lib/cards/domain";
import type { GroupTiles } from "@/lib/groupExperiences/presentationReads";

export function presentGroup(data: LoadedGroup, selection: PerspectiveSelection, verified: boolean): ExperienceDeckPresentation {
  const boot = data.bootstrap, own = selection.perspective === "self";
  const rows = selection.perspective === "group" ? boot.group : own ? boot.own
    : data.followers.find(row => row.userId === selection.subjectUserId)?.learning;
  requireCondition(rows, "GROUP_PERSPECTIVE_FORBIDDEN");
  const overall = metrics(rows);
  return { ...boot.deck, surface: "experience", id: boot.experienceId, experienceId: boot.experienceId, viewerUserId: boot.viewerUserId,
    completion: overall.completion, confidence: overall.confidence, allSkipped: progressObservationState(rows.flatMap(card => card.items)).state === "skipped",
    cards: boot.deck.cards.map(content => {
      const learning = rows.find(row => row.cardTemplateId === content.cardTemplateId);
      requireCondition(learning && learning.version === content.version, "GROUP_VERSION_CONFLICT");
      const values = metrics([learning]);
      return { ...content, surface: "experience", experienceId: boot.experienceId, viewerUserId: boot.viewerUserId,
        dataIdentity: cardLearningContextKey(boot.viewerUserId, { kind: "experience", experienceId: boot.experienceId, cardTemplateId: content.cardTemplateId,
          version: content.version, ...selection }),
        learning, canWriteLearning: verified && (selection.perspective === "group" ? boot.isAdmin : own && boot.isFollower),
        ...(own ? { ownerDate: boot.ownDates?.find(row => row.cardTemplateId === content.cardTemplateId)?.targetDate ?? null } : {}),
        completion: values.completion, confidence: values.confidence,
        aggregates: selection.perspective === "group" ? data.aggregates.find(row => row.cardTemplateId === content.cardTemplateId) : undefined,
        aggregatePending: selection.perspective === "group" ? data.aggregatePending?.[content.cardTemplateId] : undefined,
        steps: content.steps.map(step => ({ ...step, completionStatus: learning.items.find(item => item.stepId === step.stepId)!.completionStatus })),
      };
    }) };
}
export function presentGroupTile(value: GroupTiles["entries"][number]): ExperienceDeckPresentation {
  return { ...value.deck, surface: "experience", id: value.experienceId, experienceId: value.experienceId, viewerUserId: value.viewerUserId,
    cardCount: value.cardCount, isComplete: value.isComplete, allSkipped: value.allSkipped, completion: value.group.completion, confidence: value.group.confidence,
    cards: value.deck.cards.map(card => {
      const learning = value.groupLearning.find(row => row.cardTemplateId === card.cardTemplateId)!;
      const score = metrics([learning]);
      return { ...card, surface: "experience", experienceId: value.experienceId, viewerUserId: value.viewerUserId,
        dataIdentity: cardLearningContextKey(value.viewerUserId, { kind: "experience", experienceId: value.experienceId, perspective: "group", cardTemplateId: card.cardTemplateId, version: card.version }),
        learning, canWriteLearning: false, completion: score.completion, confidence: score.confidence,
        steps: card.steps.map(step => ({ ...step, completionStatus: learning.items.find(item => item.stepId === step.stepId)!.completionStatus })) };
    }) };
}

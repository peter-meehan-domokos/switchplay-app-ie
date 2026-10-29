import { assertAdoption, nonblank, requireCondition } from "./domain";

// Client/read identity only. These values are never server access grants.
export type CardLearningContext = { cardTemplateId: string; version: number } & (
  | { kind: "personal"; deckTemplateId: string }
  | ({ kind: "experience"; experienceId: string } & (
    | { perspective: "group" }
    | { perspective: "self" }
    | { perspective: "follower"; subjectUserId: string }
  ))
);

export function learningOwnerKey(userId: string, cardTemplateId: string) {
  requireCondition(nonblank(userId) && nonblank(cardTemplateId), "INVALID_LEARNING_IDENTITY");
  return JSON.stringify([userId, cardTemplateId]);
}

export function cardLearningContextKey(viewerUserId: string, context: CardLearningContext) {
  requireCondition(nonblank(viewerUserId) && nonblank(context?.cardTemplateId), "INVALID_LEARNING_CONTEXT");
  assertAdoption(context.version);
  if (context.kind === "personal") {
    requireCondition(nonblank(context.deckTemplateId), "INVALID_LEARNING_CONTEXT");
    return JSON.stringify([viewerUserId, "personal", context.deckTemplateId, context.cardTemplateId, context.version]);
  }
  requireCondition(context.kind === "experience" && nonblank(context.experienceId)
    && ["group", "self", "follower"].includes(context.perspective), "INVALID_LEARNING_CONTEXT");
  const subject = context.perspective === "group" ? null : context.perspective === "self" ? viewerUserId : context.subjectUserId;
  requireCondition(context.perspective === "group" || nonblank(subject), "INVALID_LEARNING_CONTEXT");
  return JSON.stringify([viewerUserId, "experience", context.experienceId, context.cardTemplateId,
    context.version, context.perspective, subject]);
}

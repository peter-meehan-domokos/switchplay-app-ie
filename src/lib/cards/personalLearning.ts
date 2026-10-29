import type { ClientSession } from "mongodb";
import type { CardRepository } from "./repository";
import type { CardTemplateVersion } from "./model";
import { assertAdoption, assertCardContent, initialCardData, nonblank, requireCondition } from "./domain";
import { assertLearningChange, assertLearningFields, type PersonalLearningChange } from "./learning";

type SelectedCard = Pick<CardTemplateVersion, "cardTemplateId" | "version" | "content">;

// Internal transaction primitives, not authorization entry points. The caller
// must resolve canonical content and authorize the working context for actor.
// No group routes/callers are introduced in Phase 1.
export async function ensurePersonalLearningInSession(repo: CardRepository, actor: string, selected: SelectedCard,
  session: ClientSession, options: { scheduling: "personal" | "experience"; targetDate?: string | null }) {
  requireCondition(session.inTransaction() && nonblank(actor) && nonblank(selected.cardTemplateId), "LEARNING_TRANSACTION_REQUIRED");
  assertAdoption(selected.version); assertCardContent(selected.content);
  requireCondition(options.scheduling === "personal" || options.scheduling === "experience", "INVALID_LEARNING_SCHEDULING");
  const user = await repo.getPersonalLearning(actor, selected.cardTemplateId, session);
  requireCondition(user && Array.isArray(user.cardsData), "NEW_MODEL_USER_REQUIRED");
  const matches = user.cardsData.filter(card => card.cardTemplateId === selected.cardTemplateId);
  requireCondition(matches.length <= 1, "AMBIGUOUS_CARD_DATA");
  if (matches.length) { assertLearningFields(matches[0]); return; }
  const data = initialCardData(selected.cardTemplateId, selected.version, selected.content, new Date(),
    options.scheduling === "personal" ? options.targetDate ?? null : null);
  // Group materialization must not impose even a canonical suggested deadline.
  if (options.scheduling === "experience") data.targetDate = null;
  await repo.users().updateOne({ _id: user._id, "cardsData.cardTemplateId": { $ne: selected.cardTemplateId } },
    { $push: { cardsData: data } }, { session });
}

export async function mutatePersonalLearningInSession(repo: CardRepository, actor: string, selected: SelectedCard,
  change: PersonalLearningChange, session: ClientSession) {
  requireCondition(session.inTransaction() && nonblank(actor) && nonblank(selected.cardTemplateId), "LEARNING_TRANSACTION_REQUIRED");
  assertAdoption(selected.version); assertLearningChange(selected.content, change);
  const user = await repo.getPersonalLearning(actor, selected.cardTemplateId, session);
  requireCondition(user && Array.isArray(user.cardsData), "NEW_MODEL_USER_REQUIRED");
  const matches = user.cardsData;
  requireCondition(matches.length === 1, matches.length ? "AMBIGUOUS_CARD_DATA" : "MISSING_CARD_DATA");
  const data = matches[0]; assertLearningFields(data);
  const completion = change.kind === "completion";
  const field = completion ? "items" : "signalReadings";
  const valueField = completion ? "completionStatus" : "reading";
  const value = completion ? change.completionStatus : change.reading;
  const exists = data[field].some(entry => entry.stepId === change.stepId);
  const updatedAt = new Date();
  // Never rewrite an array snapshot, the adoption pointer, or private fields.
  const result = exists
    ? await repo.users().updateOne({ _id: user!._id }, { $set: {
      [`cardsData.$[card].${field}.$[step].${valueField}`]: value, "cardsData.$[card].updatedAt": updatedAt,
    } }, { session, arrayFilters: [{ "card.cardTemplateId": selected.cardTemplateId }, { "step.stepId": change.stepId }] })
    : await repo.users().updateOne({ _id: user!._id }, {
      $push: { [`cardsData.$[card].${field}`]: { stepId: change.stepId, [valueField]: value } },
      $set: { "cardsData.$[card].updatedAt": updatedAt },
    }, { session, arrayFilters: [{ "card.cardTemplateId": selected.cardTemplateId }] });
  requireCondition(result.matchedCount === 1, "MISSING_CARD_DATA");
}

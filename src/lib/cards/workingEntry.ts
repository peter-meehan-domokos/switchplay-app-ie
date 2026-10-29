import type { MembershipDTO } from "./readModels";
import { personalWork } from "./personalWork";
import { workingCardStore } from "./workingCardStore";
import { isIsoDateOnlyString } from "../dateOnly";

// Freshness describes existing membership data; it stores no second Deck copy.
export const WORKING_PRESENTATION_FRESH_MS = 60_000;
export type WorkingPresentationFreshness = { actor: string; at: number; epoch: number };
export function canPresentWorkingMembership(membership: MembershipDTO | undefined, actor: string,
  freshness: WorkingPresentationFreshness, now = Date.now()) {
  const deck = membership?.display;
  if (!deck || membership.archivedAt !== null || membership.availability !== "available"
    || membership.dataOwnerUserId !== actor || deck.dataOwnerUserId !== actor || !deck.openedAt
    || freshness.actor !== actor || now < freshness.at || now - freshness.at >= WORKING_PRESENTATION_FRESH_MS
    || freshness.epoch !== workingCardStore.epoch(actor)) return false;
  const scope = { userId: actor, deckId: deck.deckTemplateId, cardIds: deck.cards.map(card => card.id) };
  if (personalWork.hasWork(scope) || personalWork.isLocked(scope)) return false;
  if (deck.cards.length && !deck.cards.some(card => card.id === deck.activeCardId)) return false;
  return deck.cards.every(card => isIsoDateOnlyString(card.targetDate)
    && (workingCardStore.personal(actor, card.id)?.adoptedVersion ?? card.adoptedVersion) === card.adoptedVersion);
}

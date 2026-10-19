import type { Deck } from "../../src/components/decks/types";
import type { MembershipDTO } from "../../src/lib/cards/readModels";

export function entryDeck(index = 0, actor = "alice"): Deck {
  const permissions = { templateOwnerUserId: actor, dataOwnerUserId: actor, canEditDeck: true, canPublishDeck: true,
    canArchiveDeck: true, canEditCard: true, canPublishCard: true, canForkCard: true, canMutateCardData: true, canUpdateCard: false };
  return { id: `deck-${index}`, deckTemplateId: `deck-${index}`, title: `Ready Deck ${index}`, category: null,
    context: "working", adoptedVersion: 1, dataOwnerUserId: actor, ownerUserId: actor, templateOwnerUserId: actor,
    ownerUsername: actor, showOwnerTag: false, canMutate: true, isOwnedByCurrentUser: true, hasUserDeckData: true, activeCardId: "shared-0", introduction: null,
    createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-19T00:00:00Z", openedAt: "2026-10-19T00:00:00Z", permissions,
    cards: [0, 1, 2].map(position => ({ id: `shared-${position}`, cardTemplateId: `shared-${position}`, adoptedVersion: 1,
      dataOwnerUserId: actor, templateOwnerUserId: actor, permissions, label: `Card ${position + 1}`, targetDate: "2026-10-19",
      creator: { username: actor, immediateSourceUsername: null }, intro: { title: `Practice ${position + 1}`, description: "Ready instructions", mediaItem: null },
      steps: [0, 1, 2].map(step => ({ stepId: `shared-${position}-step-${step}`, title: `Step ${step + 1}`, description: "Practice safely", completionStatus: "todo" })),
      signals: [0, 1, 2].map(step => ({ id: `shared-${position}-step-${step}`, title: `Confidence ${step + 1}`, reading: null, rawReading: null, order: "increasing", unit: null })),
      reflection: "Saved reflection", mediaItems: [], chats: [], personalHistory: [],
    })), streams: [] };
}
export function entryMembership(deck = entryDeck()): MembershipDTO {
  return { deckTemplateId: deck.id, archivedAt: null, openedAt: deck.openedAt ? new Date(deck.openedAt) : null, membershipRevision: 0, adoptedVersion: deck.adoptedVersion!,
    context: "working", dataOwnerUserId: deck.dataOwnerUserId!, availability: "available", unavailableReason: null, display: deck,
    title: deck.title, cardCount: deck.cards.length, latestVersion: deck.adoptedVersion!, updateAvailable: false,
    cardUpdatesAvailable: [], templateOwnerUserId: deck.ownerUserId, canEditDeck: true };
}

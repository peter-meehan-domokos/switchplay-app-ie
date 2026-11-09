import type { Deck } from "@/components/decks/types";
export const personalPreparationIdentity = (deck: Deck) => JSON.stringify([deck.deckTemplateId, deck.adoptedVersion,
  deck.cards.map(card => [card.cardTemplateId ?? card.id, card.adoptedVersion])]);

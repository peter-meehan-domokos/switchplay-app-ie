import { buildCardLayout, type CardLayout, type CardLayoutOptions } from "@/components/cards/cardLayout";
import type { Deck } from "@/components/decks/types";

export type DeckLayout = Omit<Deck, "cards"> & {
  cards: CardLayout[];
};

export type DeckLayoutOptions = CardLayoutOptions;

export function buildDeckLayout(deck: Deck, options: DeckLayoutOptions): DeckLayout {
  return {
    ...deck,
    cards: deck.cards.map((card) => buildCardLayout(card, options)),
  };
}

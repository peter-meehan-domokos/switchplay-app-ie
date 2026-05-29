import { buildCardLayout, type CardLayout, type CardLayoutOptions } from "@/components/cards/cardLayout";
import type { Deck } from "@/components/decks/types";
import { getProgressPercentage } from "@/lib/progress";

export type DeckLayout = Omit<Deck, "cards"> & {
  cards: CardLayout[];
  progressPercentage: number;
};

export type DeckLayoutOptions = CardLayoutOptions;

export function buildDeckLayout(deck: Deck, options: DeckLayoutOptions): DeckLayout {
  const progressPercentage = getProgressPercentage(
    deck.cards.flatMap((card) =>
      card.items.map((item) => ({ completionStatus: item.completionStatus }))
    )
  );

  return {
    ...deck,
    cards: deck.cards.map((card) => buildCardLayout(card, options)),
    progressPercentage,
  };
}

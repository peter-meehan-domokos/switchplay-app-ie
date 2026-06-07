import { buildCardLayout, type CardLayout, type CardLayoutOptions, withDerivedCardProgress } from "@/components/cards/cardLayout";
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
      card.steps.map((step) => ({ completionStatus: step.completionStatus }))
    )
  );

  return {
    ...deck,
    cards: deck.cards.map((card) => buildCardLayout(card, options)),
    progressPercentage,
  };
}

export function buildOptimisticDeckLayout(deck: DeckLayout, cards: CardLayout[]): DeckLayout {
  const optimisticCards = cards.map(withDerivedCardProgress);
  const progressPercentage = getProgressPercentage(
    optimisticCards.flatMap((card) =>
      card.steps.map((step) => ({ completionStatus: step.completionStatus }))
    )
  );

  return {
    ...deck,
    cards: optimisticCards,
    progressPercentage,
  };
}

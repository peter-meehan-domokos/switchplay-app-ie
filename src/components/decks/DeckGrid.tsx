import DeckTile from "@/components/decks/DeckTile";
import type { Deck } from "@/components/decks/types";

type DeckGridProps = {
  decks: Deck[];
  instantiatingDeckTemplateId: string | null;
  isInteractionLocked: boolean;
  onSelectDeck: (deckId: string) => void;
  transition: object;
};

export default function DeckGrid({
  decks,
  instantiatingDeckTemplateId,
  isInteractionLocked,
  onSelectDeck,
  transition,
}: DeckGridProps) {
  return (
    <div className="deck-grid">
      {decks.map((deck) => (
        <DeckTile
          key={deck.id}
          deck={deck}
          isDisabled={isInteractionLocked}
          isPreparing={instantiatingDeckTemplateId === deck.deckTemplateId}
          onSelect={() => onSelectDeck(deck.id)}
          transition={transition}
        />
      ))}
    </div>
  );
}

import DeckTile from "@/components/decks/DeckTile";
import type { DeckLayout } from "@/components/decks/deckLayout";

type DeckGridProps = {
  decks: DeckLayout[];
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

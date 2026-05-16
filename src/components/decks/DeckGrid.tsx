import DeckTile from "@/components/decks/DeckTile";
import type { Deck } from "@/components/decks/types";

type DeckGridProps = {
  decks: Deck[];
  onSelectDeck: (deckId: string) => void;
  transition: object;
};

export default function DeckGrid({ decks, onSelectDeck, transition }: DeckGridProps) {
  return (
    <div className="deck-grid">
      {decks.map((deck) => (
        <DeckTile key={deck.id} deck={deck} onSelect={() => onSelectDeck(deck.id)} transition={transition} />
      ))}
    </div>
  );
}

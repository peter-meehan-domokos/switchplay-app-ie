import { motion } from "motion/react";
import type { Deck } from "@/components/decks/types";

type DeckTileProps = {
  deck: Deck;
  onSelect: () => void;
  transition: object;
};

export default function DeckTile({ deck, onSelect, transition }: DeckTileProps) {
  return (
    <motion.button
      type="button"
      className="deck-tile"
      layout
      layoutId={`deck-${deck.id}`}
      onClick={onSelect}
      transition={transition}
      whileTap={{ scale: 0.98 }}
    >
      <span className="category-chip">{deck.category}</span>

      <motion.div className="tile-card-stack" layout>
        {deck.cards.slice(0, 3).map((card, index) => (
          <span
            className="tile-mini-card"
            key={card.id}
            style={{
              transform: `translate(${index * 8}px, ${index * -6}px) rotate(${index * 2 - 2}deg)`,
              zIndex: 3 - index,
            }}
          />
        ))}
      </motion.div>

      <span className="deck-tile-title">{deck.title}</span>
      <span className="deck-tile-meta">{deck.cards.length} weeks</span>
    </motion.button>
  );
}

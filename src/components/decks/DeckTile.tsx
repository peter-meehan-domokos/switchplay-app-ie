import { motion } from "motion/react";
import type { DeckLayout } from "@/components/decks/deckLayout";

type DeckTileProps = {
  deck: DeckLayout;
  isDisabled?: boolean;
  isPreparing?: boolean;
  onSelect: () => void;
  transition: object;
};

export default function DeckTile({ deck, isDisabled = false, isPreparing = false, onSelect, transition }: DeckTileProps) {
  const roundedProgressPercentage = Math.round(deck.progressPercentage);
  const progressMetaLabel = roundedProgressPercentage === 100 ? "Completed" : `${roundedProgressPercentage}%`;

  return (
    <motion.button
      type="button"
      className={`deck-tile${isPreparing ? " deck-tile--preparing" : ""}`}
      disabled={isDisabled}
      aria-busy={isPreparing}
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
      <span className="deck-tile-meta">{isPreparing ? "Preparing deck..." : `${deck.cards.length} weeks · ${progressMetaLabel}`}</span>
    </motion.button>
  );
}

import { motion } from "motion/react";
import CardStack from "@/components/decks/CardStack";
import type { Deck } from "@/components/decks/types";

type DeckDetailProps = {
  deck: Deck;
  onBack: () => void;
  transition: object;
};

export default function DeckDetail({ deck, onBack, transition }: DeckDetailProps) {
  return (
    <motion.section
      className="deck-detail"
      layout
      layoutId={`deck-${deck.id}`}
      transition={transition}
      initial={{ borderRadius: 16 }}
      animate={{ borderRadius: 28 }}
      exit={{ borderRadius: 16 }}
    >
      <div className="detail-topbar">
        <motion.button type="button" className="back-button" onClick={onBack} whileTap={{ scale: 0.96 }}>
          <span aria-hidden="true">←</span>
          <span>Back</span>
        </motion.button>
        <span className="category-chip detail-chip">{deck.category}</span>
      </div>

      <motion.div className="detail-heading" layout>
        <p className="eyebrow">{deck.status}</p>
        <h1>{deck.title}</h1>
      </motion.div>

      <CardStack cards={deck.cards} transition={transition} />
    </motion.section>
  );
}

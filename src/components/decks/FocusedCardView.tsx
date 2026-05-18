import { motion } from "motion/react";
import ActiveCardFront from "@/components/cards/ActiveCardFront";
import type { WeeklyCard } from "@/components/decks/types";
import { CARD_ASPECT_RATIO, FOCUSED_CARD_WIDTH } from "@/constants/cardStack";

type FocusedCardViewProps = {
  card: WeeklyCard;
  onClose: () => void;
  transition: object;
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export default function FocusedCardView({ card, onClose, transition }: FocusedCardViewProps) {
  return (
    <motion.div
      className="focused-card-layer"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <motion.button type="button" className="focused-card-scrim" onClick={onClose} aria-label="Close focused card" />
      <motion.article
        className="physical-card focused-card"
        layout
        layoutId={`week-card-${card.id}`}
        style={{ width: FOCUSED_CARD_WIDTH, aspectRatio: CARD_ASPECT_RATIO }}
        transition={transition}
      >
        <motion.button type="button" className="focused-close-button" onClick={onClose} whileTap={{ scale: 0.94 }}>
          Close
        </motion.button>
        <div className="focused-card-content">
          <ActiveCardFront
            card={card}
            dateLabel={dateFormatter.format(new Date(card.targetDate))}
            variant="focused"
          />
        </div>
      </motion.article>
    </motion.div>
  );
}

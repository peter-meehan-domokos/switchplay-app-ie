import { AnimatePresence, motion } from "motion/react";
import type { Transition } from "motion/react";
import ActiveCardFront from "@/components/cards/ActiveCardFront";
import type { WeeklyCard } from "@/components/decks/types";
import { CARD_ASPECT_RATIO, FOCUSED_CARD_WIDTH } from "@/constants/cardStack";

type FocusedCardViewProps = {
  card: WeeklyCard;
  cardIndex: number;
  totalCards: number;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onCycleItemStatus: (itemId: string) => void;
  traversalDirection: FocusedTraversalDirection;
  transition: Transition;
};

export type FocusedTraversalDirection = "next" | "previous";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const focusedTraversalVariants = {
  enter: (direction: FocusedTraversalDirection) => ({
    opacity: 0.84,
    y: direction === "next" ? 14 : -14,
  }),
  center: {
    opacity: 1,
    y: 0,
  },
  exit: (direction: FocusedTraversalDirection) => ({
    opacity: 0.78,
    y: direction === "next" ? -16 : 16,
  }),
};

export default function FocusedCardView({
  card,
  cardIndex,
  totalCards,
  onClose,
  onPrevious,
  onNext,
  onCycleItemStatus,
  traversalDirection,
  transition,
}: FocusedCardViewProps) {
  const isFirstCard = cardIndex === 0;
  const isFinalCard = cardIndex === totalCards - 1;
  const focusedCardTransition: Transition = {
    layout: transition,
    opacity: { duration: 0.22, ease: "easeOut" },
    y: { duration: 0.24, ease: "easeOut" },
  };

  return (
    <motion.div
      className="focused-card-layer"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <motion.button type="button" className="focused-card-scrim" onClick={onClose} aria-label="Close focused card" />
      <motion.button
        type="button"
        className="focused-close-button"
        onClick={onClose}
        aria-label="Exit focus mode"
        whileTap={{ scale: 0.97 }}
      />
      <AnimatePresence mode="popLayout" initial={false} custom={traversalDirection}>
        <motion.article
          key={card.id}
          className="physical-card focused-card"
          layout
          layoutId={`week-card-${card.id}`}
          style={{ width: FOCUSED_CARD_WIDTH, aspectRatio: CARD_ASPECT_RATIO }}
          custom={traversalDirection}
          variants={focusedTraversalVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={focusedCardTransition}
        >
          <div className="focused-card-content">
            <ActiveCardFront
              card={card}
              dateLabel={dateFormatter.format(new Date(card.targetDate))}
              variant="focused"
              onCycleItemStatus={onCycleItemStatus}
            />
          </div>
        </motion.article>
      </AnimatePresence>
      <div className="focused-traversal-controls" aria-label="Focused card traversal">
        <motion.button
          type="button"
          className="focused-traversal-button"
          onClick={onPrevious}
          disabled={isFirstCard}
          aria-label="Previous focused card"
          whileTap={{ scale: isFirstCard ? 1 : 0.96 }}
        >
          ←
        </motion.button>
        <motion.button
          type="button"
          className="focused-traversal-button"
          onClick={onNext}
          disabled={isFinalCard}
          aria-label="Next focused card"
          whileTap={{ scale: isFinalCard ? 1 : 0.96 }}
        >
          →
        </motion.button>
      </div>
    </motion.div>
  );
}

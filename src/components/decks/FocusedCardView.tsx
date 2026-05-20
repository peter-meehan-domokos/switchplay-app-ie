import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Transition } from "motion/react";
import ActiveCardFront from "@/components/cards/ActiveCardFront";
import BackCardExternalComment from "@/components/decks/BackCardExternalComment";
import type { BackCardExternalCommentItem } from "@/components/decks/BackCardExternalComment";
import BackCardMediaTrace from "@/components/decks/BackCardMediaTrace";
import type { BackCardMediaTraceItem } from "@/components/decks/BackCardMediaTrace";
import BackCardReflectionFragment from "@/components/decks/BackCardReflectionFragment";
import CardSemanticAnchors from "@/components/decks/CardSemanticAnchors";
import type { WeeklyCard } from "@/components/decks/types";
import PulseFieldSignal from "@/components/decks/PulseFieldSignal";
import type { PulseFieldSignalVariant } from "@/components/decks/PulseFieldSignal";
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
});

const backsideSignalPlaceholders: Array<{ title: string; value: number; reading: number; variant: PulseFieldSignalVariant }> = [
  { title: "Recovery state", value: 0.6, reading: 72, variant: "recovery" },
  { title: "Movement confidence", value: 0.45, reading: 4, variant: "movement" },
  { title: "Load tolerance", value: 0.7, reading: 118, variant: "load" },
];

const backsideMediaTracePlaceholder: BackCardMediaTraceItem = {
  id: "trace-001",
  mediaType: "image",
  description: "Retained weekly media trace",
  src: "/images/media-traces/gym-trace-01.png",
};

const backsideReflectionPlaceholder = "Still rushing under fatigue";

const backsideExternalCommentPlaceholder: BackCardExternalCommentItem = {
  id: "external-comment-001",
  text: "Much calmer transition",
  author: "Liam",
};

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
  const [flipState, setFlipState] = useState({ cardId: card.id, isFlipped: false });
  const isFlipped = flipState.cardId === card.id && flipState.isFlipped;
  const dateLabel = dateFormatter.format(new Date(card.targetDate));
  const isFirstCard = cardIndex === 0;
  const isFinalCard = cardIndex === totalCards - 1;
  const focusedCardTransition: Transition = {
    layout: transition,
    opacity: { duration: 0.22, ease: "easeOut" },
    y: { duration: 0.24, ease: "easeOut" },
  };
  const flipTransition: Transition = {
    duration: 0.68,
    ease: [0.22, 0.72, 0.18, 1],
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
          className="focused-card-stage"
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
          <motion.div
            className={`focused-card-object${isFlipped ? " is-flipped" : ""}`}
            animate={{
              rotateY: isFlipped ? 180 : 0,
              boxShadow: isFlipped
                ? "0 30px 96px rgba(0, 0, 0, 0.6)"
                : "0 28px 90px rgba(0, 0, 0, 0.58)",
            }}
            transition={flipTransition}
          >
            <div className="physical-card focused-card-surface focused-card-surface--front" aria-hidden={isFlipped} inert={isFlipped}>
              <div className="focused-card-content">
                <ActiveCardFront
                  card={card}
                  dateLabel={dateLabel}
                  variant="focused"
                  onCycleItemStatus={onCycleItemStatus}
                />
              </div>
              <button
                type="button"
                className="focused-card-flip-affordance"
                onClick={() => setFlipState({ cardId: card.id, isFlipped: true })}
                aria-label="Turn card over"
              />
            </div>
            <div className="physical-card focused-card-surface focused-card-surface--back" aria-hidden={!isFlipped} inert={!isFlipped}>
              <CardSemanticAnchors card={card} dateLabel={dateLabel} showProgress={false} variant="back" />
              <div className="focused-card-back-shell">
                <BackCardMediaTrace trace={backsideMediaTracePlaceholder} />
                <section className="focused-card-back-signals" aria-label="Reflective card signals">
                  {backsideSignalPlaceholders.map((signal) => (
                    <div className="focused-card-signal-slot" key={signal.title}>
                      <p>{signal.title}</p>
                      <PulseFieldSignal value={signal.value} variant={signal.variant} className="focused-card-signal-trace" />
                      <span className={`focused-card-signal-value focused-card-signal-value--${signal.variant}`}>
                        {signal.reading}
                      </span>
                    </div>
                  ))}
                </section>
                <BackCardExternalComment comment={backsideExternalCommentPlaceholder} />
                <BackCardReflectionFragment text={backsideReflectionPlaceholder} />
              </div>
              <button
                type="button"
                className="focused-card-flip-affordance focused-card-flip-affordance--back"
                onClick={() => setFlipState({ cardId: card.id, isFlipped: false })}
                aria-label="Return to card front"
              />
            </div>
          </motion.div>
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

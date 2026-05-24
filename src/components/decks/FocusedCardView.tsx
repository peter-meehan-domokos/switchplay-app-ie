import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Transition } from "motion/react";
import ActiveCardFront from "@/components/cards/ActiveCardFront";
import type { CardLayout } from "@/components/cards/cardLayout";
import BackCardExternalComment from "@/components/decks/BackCardExternalComment";
import BackCardMediaTrace from "@/components/decks/BackCardMediaTrace";
import BackCardReflectionFragment from "@/components/decks/BackCardReflectionFragment";
import CardSemanticAnchors from "@/components/decks/CardSemanticAnchors";
import { useDeckGestures } from "@/components/decks/gestures/useDeckGestures";
import type { GestureCommitment, GestureVector } from "@/components/decks/gestures/gestureTypes";
import PulseFieldSignal from "@/components/decks/PulseFieldSignal";
import { CARD_ASPECT_RATIO, PROGRESSION_CARD_WIDTH } from "@/constants/cardStack";

type FocusedCardViewProps = {
  card: CardLayout;
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

type FocusedFlipSide = "front" | "back";

type FocusedFlipState = {
  cardId: string;
  side: FocusedFlipSide;
  rotationY: number;
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
});

const FOCUSED_FLIP_LOCK_MS = 680;
const FOCUSED_TRAVERSAL_LOCK_MS = 280;
const FOCUSED_CARD_OBJECT_SCALE = 1.56;

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
  const [flipState, setFlipState] = useState<FocusedFlipState>({ cardId: card.id, side: "front", rotationY: 0 });
  const [isFocusedGestureLocked, setIsFocusedGestureLocked] = useState(false);
  const focusedGestureLockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardFlipState = flipState.cardId === card.id ? flipState : { cardId: card.id, side: "front", rotationY: 0 };
  const isFlipped = cardFlipState.side === "back";
  const dateLabel = dateFormatter.format(new Date(card.targetDate));
  const isFirstCard = cardIndex === 0;
  const isFinalCard = cardIndex === totalCards - 1;
  const hasBackMediaTrace = Boolean(card.backMediaTrace);
  const backSignalsClassName = [
    "focused-card-back-signals",
    !hasBackMediaTrace ? "focused-card-back-signals--no-media" : undefined,
  ]
    .filter(Boolean)
    .join(" ");
  const externalCommentClassName =
    !hasBackMediaTrace && card.externalComment ? "focused-card-back-external-comment--no-media" : undefined;
  const focusedCardTransition: Transition = {
    layout: transition,
    opacity: { duration: 0.22, ease: "easeOut" },
    y: { duration: 0.24, ease: "easeOut" },
  };
  const flipTransition: Transition = {
    duration: 0.68,
    ease: [0.22, 0.72, 0.18, 1],
  };
  const lockFocusedGestures = (durationMs: number) => {
    if (focusedGestureLockTimeoutRef.current) {
      clearTimeout(focusedGestureLockTimeoutRef.current);
    }

    setIsFocusedGestureLocked(true);
    focusedGestureLockTimeoutRef.current = setTimeout(() => {
      setIsFocusedGestureLocked(false);
      focusedGestureLockTimeoutRef.current = null;
    }, durationMs);
  };
  const toggleFocusedCardSide = (commitment: GestureCommitment, vector: GestureVector) => {
    if (isFocusedGestureLocked) {
      return;
    }

    lockFocusedGestures(FOCUSED_FLIP_LOCK_MS);
    setFlipState((currentFlipState) => {
      const currentCardFlipState =
        currentFlipState.cardId === card.id ? currentFlipState : { cardId: card.id, side: "front" as const, rotationY: 0 };
      const directionDelta =
        commitment.direction === "right" || (!commitment.direction && vector.x > 0)
          ? 180
          : -180;

      return {
        cardId: card.id,
        side: currentCardFlipState.side === "front" ? "back" : "front",
        rotationY: currentCardFlipState.rotationY + directionDelta,
      };
    });
  };
  const settleFocusedCardToPast = () => {
    if (isFocusedGestureLocked || isFinalCard) {
      return;
    }

    lockFocusedGestures(FOCUSED_TRAVERSAL_LOCK_MS);
    onNext();
  };
  const restoreFocusedCardFromPast = () => {
    if (isFocusedGestureLocked || isFirstCard) {
      return;
    }

    lockFocusedGestures(FOCUSED_TRAVERSAL_LOCK_MS);
    onPrevious();
  };
  const focusedGestures = useDeckGestures({
    mode: "focus",
    allowedIntents: ["settleToPast", "restoreFromPast", "flip"],
    locked: isFocusedGestureLocked,
    onSettleToPast: settleFocusedCardToPast,
    onRestoreFromPast: restoreFocusedCardFromPast,
    onFlip: toggleFocusedCardSide,
  });

  useEffect(() => {
    setFlipState({ cardId: card.id, side: "front", rotationY: 0 });
  }, [card.id]);

  useEffect(() => {
    return () => {
      if (focusedGestureLockTimeoutRef.current) {
        clearTimeout(focusedGestureLockTimeoutRef.current);
      }
    };
  }, []);

  return (
    <motion.div
      className="focused-card-layer"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <motion.button type="button" className="focused-card-scrim" onClick={onClose} aria-label="Close focused card" />
      <AnimatePresence mode="popLayout" initial={false} custom={traversalDirection}>
        <motion.article
          key={card.id}
          className="focused-card-stage"
          layout
          layoutId={`week-card-${card.id}`}
          style={{ width: PROGRESSION_CARD_WIDTH, aspectRatio: CARD_ASPECT_RATIO }}
          custom={traversalDirection}
          variants={focusedTraversalVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={focusedCardTransition}
        >
          <motion.div
            className={`focused-card-object${isFlipped ? " is-flipped" : ""}`}
            {...focusedGestures.handlers}
            animate={{
              rotateY: cardFlipState.rotationY,
              scale: FOCUSED_CARD_OBJECT_SCALE,
              boxShadow: isFlipped
                ? "0 34px 112px rgba(0, 0, 0, 0.66)"
                : "0 32px 104px rgba(0, 0, 0, 0.64)",
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
            </div>
            <div className="physical-card focused-card-surface focused-card-surface--back" aria-hidden={!isFlipped} inert={!isFlipped}>
              <CardSemanticAnchors card={card} dateLabel={dateLabel} showProgress={false} variant="back" />
              <div className="focused-card-back-shell">
                <BackCardMediaTrace trace={card.backMediaTrace} />
                <section className={backSignalsClassName} aria-label="Reflective card signals">
                  {card.signals.map((signal) => (
                    <div className="focused-card-signal-slot" key={signal.title}>
                      <p>{signal.title}</p>
                      <PulseFieldSignal value={signal.value} variant={signal.variant} className="focused-card-signal-trace" />
                      <span className={`focused-card-signal-value focused-card-signal-value--${signal.variant}`}>
                        {signal.reading}
                      </span>
                    </div>
                  ))}
                </section>
                <BackCardExternalComment comment={card.externalComment} className={externalCommentClassName} />
                <BackCardReflectionFragment reflectionVerticalOffset={card.reflectionVerticalOffset} text={card.reflection} />
              </div>
            </div>
          </motion.div>
        </motion.article>
      </AnimatePresence>
    </motion.div>
  );
}

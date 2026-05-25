"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import CardStack from "@/components/decks/CardStack";
import type { CardTransitionPhase } from "@/components/decks/CardStack";
import type { DeckLayout } from "@/components/decks/deckLayout";
import FocusedCardView from "@/components/decks/FocusedCardView";
import type { FocusedTraversalDirection } from "@/components/decks/FocusedCardView";
import { DECK_GESTURE_THRESHOLDS } from "@/components/decks/gestures/gestureThresholds";
import { useDeckGestures } from "@/components/decks/gestures/useDeckGestures";
import type { CompletionStatus } from "@/components/decks/types";
import { ROLE_TRANSITION_SETTLE_MS } from "@/constants/cardStack";
import { normalizeCompletionStatus } from "@/lib/progress";

type DeckDetailProps = {
  deck: DeckLayout;
  isDeckFlipped: boolean;
  onBack: () => void;
  onToggleDeckFlip: () => void;
  transition: object;
};

const itemProgressCycle: CompletionStatus[] = ["todo", "inProgress", "done", "skipped"];

function getNextCompletionStatus(currentStatus: CompletionStatus) {
  const currentIndex = itemProgressCycle.indexOf(currentStatus);
  return itemProgressCycle[(currentIndex + 1) % itemProgressCycle.length];
}

export default function DeckDetail({ deck, isDeckFlipped, onBack, onToggleDeckFlip, transition }: DeckDetailProps) {
  const [cards, setCards] = useState(deck.cards);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [transitionPhase, setTransitionPhase] = useState<CardTransitionPhase | null>(null);
  const [isFocusModeOpen, setIsFocusModeOpen] = useState(false);
  const [focusedTraversalDirection, setFocusedTraversalDirection] = useState<FocusedTraversalDirection>("next");
  const roleTransitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalCardIndex = cards.length - 1;

  useEffect(() => {
    return () => {
      if (roleTransitionTimeoutRef.current) {
        clearTimeout(roleTransitionTimeoutRef.current);
      }
    };
  }, []);

  const moveActiveCard = (nextCardIndex: number) => {
    if (nextCardIndex === activeCardIndex || transitionPhase) {
      return;
    }

    if (roleTransitionTimeoutRef.current) {
      clearTimeout(roleTransitionTimeoutRef.current);
    }

    setTransitionPhase({
      fromIndex: activeCardIndex,
      toIndex: nextCardIndex,
      direction: nextCardIndex > activeCardIndex ? "next" : "previous",
    });

    roleTransitionTimeoutRef.current = setTimeout(() => {
      setActiveCardIndex(nextCardIndex);
      setTransitionPhase(null);
      roleTransitionTimeoutRef.current = null;
    }, ROLE_TRANSITION_SETTLE_MS);
  };

  const goToPreviousCard = () => {
    moveActiveCard(Math.max(activeCardIndex - 1, 0));
  };

  const goToNextCard = () => {
    moveActiveCard(Math.min(activeCardIndex + 1, finalCardIndex));
  };

  const openFocusMode = (cardIndex: number) => {
    setActiveCardIndex(cardIndex);
    setIsFocusModeOpen(true);
  };

  const closeFocusMode = () => {
    setIsFocusModeOpen(false);
  };

  const moveFocusedCard = (nextCardIndex: number) => {
    if (nextCardIndex === activeCardIndex) {
      return;
    }

    setFocusedTraversalDirection(nextCardIndex > activeCardIndex ? "next" : "previous");
    setActiveCardIndex(nextCardIndex);
  };

  const goToPreviousFocusedCard = () => {
    moveFocusedCard(Math.max(activeCardIndex - 1, 0));
  };

  const goToNextFocusedCard = () => {
    moveFocusedCard(Math.min(activeCardIndex + 1, finalCardIndex));
  };

  const cycleFocusedItemStatus = (itemId: string) => {
    setCards((currentCards) =>
      currentCards.map((card, cardIndex) => {
        if (cardIndex !== activeCardIndex) {
          return card;
        }

        return {
          ...card,
          items: card.items.map((item) =>
            item.id === itemId
              ? { ...item, completionStatus: getNextCompletionStatus(normalizeCompletionStatus(item.completionStatus)) }
              : item
          ),
        };
      })
    );
  };
  const deckGestures = useDeckGestures({
    mode: "deck",
    allowedIntents: ["settleToPast", "restoreFromPast"],
    locked: transitionPhase !== null || isFocusModeOpen,
    onSettleToPast: goToNextCard,
    onRestoreFromPast: goToPreviousCard,
  });
  const latestPastGestures = useDeckGestures({
    mode: "deck",
    allowedIntents: ["restoreFromPast"],
    locked: transitionPhase !== null || isFocusModeOpen || activeCardIndex === 0,
    onRestoreFromPast: goToPreviousCard,
  });
  const activeGesturePreviewY =
    deckGestures.phase === "dragging" &&
    deckGestures.intent === "settleToPast" &&
    deckGestures.direction === "down" &&
    activeCardIndex < finalCardIndex
      ? Math.min(72, Math.max(0, deckGestures.previewVector.y))
      : deckGestures.phase === "dragging" &&
          deckGestures.intent === "restoreFromPast" &&
          deckGestures.direction === "up" &&
          activeCardIndex > 0
        ? Math.max(-72, Math.min(0, deckGestures.previewVector.y))
      : 0;
  const suppressActiveCardActivation =
    (deckGestures.phase === "dragging" || deckGestures.phase === "committed" || deckGestures.phase === "cancelled") &&
    deckGestures.vector.distance >= DECK_GESTURE_THRESHOLDS.deadZonePx;

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
      <motion.button
        type="button"
        className="back-button deck-back-overlay"
        onClick={onBack}
        whileTap={{ scale: 0.96 }}
      >
        <span aria-hidden="true">←</span>
        <span>Back</span>
      </motion.button>

      <motion.div className="detail-heading" layout>
        <p className="eyebrow">{deck.status}</p>
        <h1>{deck.title}</h1>
      </motion.div>

      <button type="button" className="deck-flip-debug-toggle" onClick={onToggleDeckFlip}>
        {isDeckFlipped ? "Show fronts" : "Show backs"}
      </button>

      <CardStack
        cards={cards}
        activeCardIndex={activeCardIndex}
        isDeckFlipped={isDeckFlipped}
        transitionPhase={transitionPhase}
        onFocusCard={openFocusMode}
        activeGestureHandlers={deckGestures.handlers}
        latestPastGestureHandlers={latestPastGestures.handlers}
        activeGesturePreviewY={activeGesturePreviewY}
        suppressActiveCardActivation={suppressActiveCardActivation}
        transition={transition}
      />

      <AnimatePresence>
        {isFocusModeOpen ? (
          <FocusedCardView
            card={cards[activeCardIndex]}
            cardIndex={activeCardIndex}
            totalCards={cards.length}
            onClose={closeFocusMode}
            onPrevious={goToPreviousFocusedCard}
            onNext={goToNextFocusedCard}
            onCycleItemStatus={cycleFocusedItemStatus}
            isDeckFlipped={isDeckFlipped}
            traversalDirection={focusedTraversalDirection}
            transition={transition}
          />
        ) : null}
      </AnimatePresence>
    </motion.section>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import CardStack from "@/components/decks/CardStack";
import type { CardTransitionPhase } from "@/components/decks/CardStack";
import type { DeckLayout } from "@/components/decks/deckLayout";
import FocusedCardView from "@/components/decks/FocusedCardView";
import type { FocusedTraversalDirection } from "@/components/decks/FocusedCardView";
import type { CompletionStatus } from "@/components/decks/types";
import { ROLE_TRANSITION_SETTLE_MS } from "@/constants/cardStack";
import { normalizeCompletionStatus } from "@/lib/progress";

type DeckDetailProps = {
  deck: DeckLayout;
  onBack: () => void;
  transition: object;
};

const itemProgressCycle: CompletionStatus[] = ["todo", "inProgress", "done", "skipped"];

function getNextCompletionStatus(currentStatus: CompletionStatus) {
  const currentIndex = itemProgressCycle.indexOf(currentStatus);
  return itemProgressCycle[(currentIndex + 1) % itemProgressCycle.length];
}

export default function DeckDetail({ deck, onBack, transition }: DeckDetailProps) {
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
        <div className="detail-tools">
          <span className="stack-position">
            {activeCardIndex + 1} / {cards.length}
          </span>
          <motion.button
            type="button"
            className="stack-control-button"
            onClick={goToPreviousCard}
            disabled={activeCardIndex === 0 || transitionPhase !== null}
            aria-label="Previous card"
            whileTap={{ scale: activeCardIndex === 0 ? 1 : 0.94 }}
          >
            ←
          </motion.button>
          <motion.button
            type="button"
            className="stack-control-button"
            onClick={goToNextCard}
            disabled={activeCardIndex === finalCardIndex || transitionPhase !== null}
            aria-label="Next card"
            whileTap={{ scale: activeCardIndex === finalCardIndex ? 1 : 0.94 }}
          >
            →
          </motion.button>
        </div>
      </div>

      <motion.div className="detail-heading" layout>
        <p className="eyebrow">{deck.status}</p>
        <h1>{deck.title}</h1>
      </motion.div>

      <CardStack
        cards={cards}
        activeCardIndex={activeCardIndex}
        transitionPhase={transitionPhase}
        onFocusCard={openFocusMode}
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
            traversalDirection={focusedTraversalDirection}
            transition={transition}
          />
        ) : null}
      </AnimatePresence>
    </motion.section>
  );
}

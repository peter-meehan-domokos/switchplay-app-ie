"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { AnimatePresence, motion } from "motion/react";
import CardStack from "@/components/decks/CardStack";
import type { CardTransitionPhase } from "@/components/decks/CardStack";
import { buildOptimisticDeckLayout } from "@/components/decks/deckLayout";
import type { DeckLayout } from "@/components/decks/deckLayout";
import FocusedCardView from "@/components/decks/FocusedCardView";
import type { FocusedTraversalDirection } from "@/components/decks/FocusedCardView";
import { DECK_GESTURE_THRESHOLDS } from "@/components/decks/gestures/gestureThresholds";
import { useDeckGestures } from "@/components/decks/gestures/useDeckGestures";
import type { GestureCommitment, GestureVector } from "@/components/decks/gestures/gestureTypes";
import type { CompletionStatus } from "@/components/decks/types";
import {
  DECK_SCENE_BASELINE_HEIGHT,
  DECK_SCENE_BASELINE_WIDTH,
  DECK_SCENE_BOTTOM_CROP_ALLOWANCE,
  ROLE_TRANSITION_SETTLE_MS,
} from "@/constants/cardStack";
import { persistActiveCardId, persistItemCompletionStatus } from "@/lib/deckMutations";
import { normalizeCompletionStatus } from "@/lib/progress";

type DeckDetailProps = {
  deck: DeckLayout;
  isDeckFlipped: boolean;
  deckFlipRotationY: number;
  onBack: () => void;
  onToggleDeckFlip: (rotationDelta?: number) => void;
  transition: object;
};

const itemProgressCycle: CompletionStatus[] = ["todo", "inProgress", "done", "skipped"];
const ACTIVE_SETTLE_PREVIEW_MAX_Y = 8;

type DeckSceneLayout = {
  frameHeight: number | null;
  scale: number;
};

const defaultDeckSceneLayout: DeckSceneLayout = {
  frameHeight: null,
  scale: 1,
};

function getViewportSize() {
  if (typeof window === "undefined") {
    return null;
  }

  const visualViewport = window.visualViewport;

  return {
    width: visualViewport && visualViewport.width > 0 ? visualViewport.width : window.innerWidth,
    height: visualViewport && visualViewport.height > 0 ? visualViewport.height : window.innerHeight,
  };
}

function getDeckSceneLayout(deckDetailElement: HTMLElement | null, deckSceneFrameElement: HTMLElement | null): DeckSceneLayout {
  const viewportSize = getViewportSize();

  if (!viewportSize || !deckDetailElement || !deckSceneFrameElement) {
    return defaultDeckSceneLayout;
  }

  const deckSceneFrameRect = deckSceneFrameElement.getBoundingClientRect();
  const availableHeight = Math.max(0, viewportSize.height - deckSceneFrameRect.top);
  const availableHeightWithCropAllowance = availableHeight + DECK_SCENE_BOTTOM_CROP_ALLOWANCE;
  const scale = Math.min(
    viewportSize.width / DECK_SCENE_BASELINE_WIDTH,
    availableHeightWithCropAllowance / DECK_SCENE_BASELINE_HEIGHT,
    1
  );
  const scaledSceneHeight = DECK_SCENE_BASELINE_HEIGHT * scale;

  return {
    frameHeight: Math.min(availableHeight, scaledSceneHeight),
    scale,
  };
}

function useDeckSceneLayout(
  deckDetailRef: RefObject<HTMLElement | null>,
  deckSceneFrameRef: RefObject<HTMLDivElement | null>
) {
  const [deckSceneLayout, setDeckSceneLayout] = useState<DeckSceneLayout>(defaultDeckSceneLayout);

  useEffect(() => {
    const scheduledTimeouts: number[] = [];
    const updateDeckSceneLayout = () => {
      const nextDeckSceneLayout = getDeckSceneLayout(deckDetailRef.current, deckSceneFrameRef.current);

      setDeckSceneLayout((currentDeckSceneLayout) => {
        const currentFrameHeight = currentDeckSceneLayout.frameHeight ?? -1;
        const nextFrameHeight = nextDeckSceneLayout.frameHeight ?? -1;
        const hasStableFrameHeight = Math.abs(currentFrameHeight - nextFrameHeight) < 0.5;
        const hasStableScale = Math.abs(currentDeckSceneLayout.scale - nextDeckSceneLayout.scale) < 0.001;

        return hasStableFrameHeight && hasStableScale ? currentDeckSceneLayout : nextDeckSceneLayout;
      });
    };
    const scheduleDeckSceneLayoutUpdate = () => {
      updateDeckSceneLayout();
      window.requestAnimationFrame(updateDeckSceneLayout);
      scheduledTimeouts.push(window.setTimeout(updateDeckSceneLayout, 180));
      scheduledTimeouts.push(window.setTimeout(updateDeckSceneLayout, 420));
    };
    const resizeObserver = new ResizeObserver(updateDeckSceneLayout);

    scheduleDeckSceneLayoutUpdate();

    if (deckDetailRef.current) {
      resizeObserver.observe(deckDetailRef.current);
    }

    if (deckSceneFrameRef.current) {
      resizeObserver.observe(deckSceneFrameRef.current);
    }

    window.addEventListener("resize", scheduleDeckSceneLayoutUpdate);
    window.visualViewport?.addEventListener("resize", scheduleDeckSceneLayoutUpdate);
    window.visualViewport?.addEventListener("scroll", scheduleDeckSceneLayoutUpdate);

    return () => {
      scheduledTimeouts.forEach(window.clearTimeout);
      resizeObserver.disconnect();
      window.removeEventListener("resize", scheduleDeckSceneLayoutUpdate);
      window.visualViewport?.removeEventListener("resize", scheduleDeckSceneLayoutUpdate);
      window.visualViewport?.removeEventListener("scroll", scheduleDeckSceneLayoutUpdate);
    };
  }, [deckDetailRef, deckSceneFrameRef]);

  return deckSceneLayout;
}

function getNextCompletionStatus(currentStatus: CompletionStatus) {
  const currentIndex = itemProgressCycle.indexOf(currentStatus);
  return itemProgressCycle[(currentIndex + 1) % itemProgressCycle.length];
}

export default function DeckDetail({ deck, isDeckFlipped, deckFlipRotationY, onBack, onToggleDeckFlip, transition }: DeckDetailProps) {
  const [cards, setCards] = useState(deck.cards);
  const [activeCardIndex, setActiveCardIndex] = useState(() => {
    const initialCardIndex = deck.cards.findIndex((card) => card.id === deck.activeCardId);
    return initialCardIndex >= 0 ? initialCardIndex : 0;
  });
  const [transitionPhase, setTransitionPhase] = useState<CardTransitionPhase | null>(null);
  const [isFocusModeOpen, setIsFocusModeOpen] = useState(false);
  const [focusedTraversalDirection, setFocusedTraversalDirection] = useState<FocusedTraversalDirection>("next");
  const deckDetailRef = useRef<HTMLElement | null>(null);
  const deckSceneFrameRef = useRef<HTMLDivElement | null>(null);
  const roleTransitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deckSceneLayout = useDeckSceneLayout(deckDetailRef, deckSceneFrameRef);
  // `deck` is the stable shell from the parent (identity/persistence fields remain authoritative).
  // `cards` is DeckDetail's optimistic local mutation source for item state.
  // Re-derive layout progress from local cards so progress text/strips update immediately,
  // while deck identity and persistence fields continue to come from `deck`.
  const optimisticDeck = useMemo(() => buildOptimisticDeckLayout(deck, cards), [deck, cards]);
  const finalCardIndex = optimisticDeck.cards.length - 1;

  useEffect(() => {
    return () => {
      if (roleTransitionTimeoutRef.current) {
        clearTimeout(roleTransitionTimeoutRef.current);
      }
    };
  }, []);

  const commitActiveCardIndex = (nextCardIndex: number) => {
    if (nextCardIndex === activeCardIndex) {
      return;
    }

    const nextActiveCardId = cards[nextCardIndex]?.id;

    if (!nextActiveCardId) {
      setActiveCardIndex(nextCardIndex);
      return;
    }

    setActiveCardIndex(nextCardIndex);

    if (!deck.hasUserDeckData) {
      return;
    }

    void persistActiveCardId(deck.deckTemplateId, nextActiveCardId).catch((error) => {
      console.warn("Unable to persist active card position.", error);
    });
  };

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
      commitActiveCardIndex(nextCardIndex);
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
    commitActiveCardIndex(cardIndex);
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
    commitActiveCardIndex(nextCardIndex);
  };

  const goToPreviousFocusedCard = () => {
    moveFocusedCard(Math.max(activeCardIndex - 1, 0));
  };

  const goToNextFocusedCard = () => {
    moveFocusedCard(Math.min(activeCardIndex + 1, finalCardIndex));
  };

  const cycleFocusedItemStatus = (itemId: string) => {
    const activeCard = cards[activeCardIndex];

    if (!activeCard) {
      return;
    }

    const currentItem = activeCard.items.find((item) => item.id === itemId);

    if (!currentItem) {
      return;
    }

    const nextCompletionStatus = getNextCompletionStatus(normalizeCompletionStatus(currentItem.completionStatus));

    setCards((currentCards) =>
      currentCards.map((card, cardIndex) => {
        if (cardIndex !== activeCardIndex) {
          return card;
        }

        return {
          ...card,
          items: card.items.map((item) =>
            item.id === itemId
              ? { ...item, completionStatus: nextCompletionStatus }
              : item
          ),
        };
      })
    );

    if (!deck.hasUserDeckData) {
      return;
    }

    void persistItemCompletionStatus(deck.deckTemplateId, activeCard.id, itemId, nextCompletionStatus).catch((error) => {
      console.warn("Unable to persist item completion status.", error);
    });
  };
  const toggleDeckSide = (commitment: GestureCommitment, vector: GestureVector) => {
    const directionDelta = commitment.direction === "right" || (!commitment.direction && vector.x > 0) ? 180 : -180;

    onToggleDeckFlip(directionDelta);
  };
  const deckGestures = useDeckGestures({
    mode: "deck",
    allowedIntents: ["settleToPast", "restoreFromPast", "flip"],
    locked: transitionPhase !== null || isFocusModeOpen,
    onSettleToPast: goToNextCard,
    onRestoreFromPast: goToPreviousCard,
    onFlip: toggleDeckSide,
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
      ? Math.min(ACTIVE_SETTLE_PREVIEW_MAX_Y, Math.max(0, deckGestures.previewVector.y))
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
      ref={deckDetailRef}
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
        <p className="detail-progress">{Math.round(optimisticDeck.progressPercentage) === 100 ? "Completed" : `Completion ${Math.round(optimisticDeck.progressPercentage)}%`}</p>
        <h1>{deck.title}</h1>
      </motion.div>

      <div
        ref={deckSceneFrameRef}
        className="deck-scene-frame"
        style={deckSceneLayout.frameHeight === null ? undefined : { height: deckSceneLayout.frameHeight }}
      >
        <div className="deck-scene-scaler" style={{ transform: `scale(${deckSceneLayout.scale})` }}>
          <CardStack
            cards={optimisticDeck.cards}
            activeCardIndex={activeCardIndex}
            isDeckFlipped={isDeckFlipped}
            deckFlipRotationY={deckFlipRotationY}
            transitionPhase={transitionPhase}
            onFocusCard={openFocusMode}
            activeGestureHandlers={deckGestures.handlers}
            latestPastGestureHandlers={latestPastGestures.handlers}
            activeGesturePreviewY={activeGesturePreviewY}
            suppressActiveCardActivation={suppressActiveCardActivation}
            transition={transition}
          />
        </div>
      </div>

      <AnimatePresence>
        {isFocusModeOpen ? (
          <FocusedCardView
            card={optimisticDeck.cards[activeCardIndex]}
            cardIndex={activeCardIndex}
            totalCards={optimisticDeck.cards.length}
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

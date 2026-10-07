"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { AnimatePresence, motion } from "motion/react";
import { workingCardStore } from "@/lib/cards/workingCardStore";
import CardStack from "@/components/decks/CardStack";
import type { CardTransitionPhase } from "@/components/decks/CardStack";
import { withCardMediaItems, withUpdatedSignalReading, withUpdatedReflection } from "@/components/cards/cardLayout";
import { getPlayableDeckIntroductionVideo } from "@/components/decks/deckIntroPreview";
import DeckMenu from "@/components/decks/DeckMenu";
import { buildOptimisticDeckLayout } from "@/components/decks/deckLayout";
import type { DeckLayout } from "@/components/decks/deckLayout";
import FocusedCardView from "@/components/decks/FocusedCardView";
import type { FocusedTraversalDirection } from "@/components/decks/FocusedCardView";
import { OptimisticSignalManager } from "@/lib/OptimisticSignalManager";
import { DECK_GESTURE_THRESHOLDS } from "@/components/decks/gestures/gestureThresholds";
import { useDeckGestures } from "@/components/decks/gestures/useDeckGestures";
import type { GestureCommitment, GestureVector } from "@/components/decks/gestures/gestureTypes";
import CloudflareHlsVideoPlayer, {
  type CloudflareHlsVideoPlayerHandle,
  type VideoPlaybackState,
} from "@/components/media/CloudflareHlsVideoPlayer";
import type { UserCardMediaUploadTarget } from "@/components/media/useKeyedUserCardMediaUploadController";
import type { CompletionStatus } from "@/components/decks/types";
import {
  DECK_SCENE_BASELINE_HEIGHT,
  DECK_SCENE_BASELINE_WIDTH,
  DECK_SCENE_BOTTOM_CROP_ALLOWANCE,
  ROLE_TRANSITION_SETTLE_MS,
} from "@/constants/cardStack";
import {
  persistActiveCardId,
  appendCardMediaItem,
  persistCardReflection,
  persistCardTargetDate,
  persistSignalReading,
  persistStepCompletionStatus,
  removePersonalCardMediaItem,
} from "@/lib/deckMutations";
import { addDaysToDateOnly } from "@/lib/dateOnly";
import { normalizeCompletionStatus } from "@/lib/progress";
import { roundSignalReadingForStorage } from "@/lib/signals";
import type { MediaItem } from "@/lib/media";
import type { ModernUserCardMediaItem } from "@/lib/userCardMedia";
import { UserCardMediaMutationQueue } from "@/lib/userCardMediaMutationQueue";

type DeckDetailProps = {
  deck: DeckLayout;
  isDeckFlipped: boolean;
  deckFlipRotationY: number;
  onBack: () => void;
  onToggleDeckFlip: (rotationDelta?: number) => void;
  transition: object;
};

const stepProgressCycle: CompletionStatus[] = ["todo", "inProgress", "done", "skipped"];
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
  const currentIndex = stepProgressCycle.indexOf(currentStatus);
  return stepProgressCycle[(currentIndex + 1) % stepProgressCycle.length];
}

function addDaysToDateString(dateString: string, amount: number) {
  return addDaysToDateOnly(dateString, amount);
}

export default function DeckDetail({ deck, isDeckFlipped, deckFlipRotationY, onBack, onToggleDeckFlip, transition }: DeckDetailProps) {
  const canMutate = deck.dataOwnerUserId != null && deck.cards.every((card) => card.permissions?.canMutateCardData && card.permissions.dataOwnerUserId === deck.dataOwnerUserId);
  const [mutationError, setMutationError] = useState("");
  const [cards, setCards] = useState(() => deck.dataOwnerUserId ? deck.cards.map((card) => workingCardStore.project(deck.dataOwnerUserId!, card)) : deck.cards);
  const fieldTokens = useRef(new Map<string, symbol>());
  const confirmedFields = useRef(new Map<string, unknown>());
  // cardsRef is the immediate optimistic source of truth for target-date edits.
  // We update it synchronously before setCards(...) so rapid taps always calculate
  // from the latest optimistic state rather than waiting for React render/effect timing.
  // This avoids missed persistence updates and prepares the interaction for future
  // long-press acceleration.
  const cardsRef = useRef(cards);
  const cardMediaMutationQueueRef = useRef<UserCardMediaMutationQueue | null>(null);

  if (cardMediaMutationQueueRef.current === null) {
    cardMediaMutationQueueRef.current = new UserCardMediaMutationQueue();
  }
  const [activeCardIndex, setActiveCardIndex] = useState(() => {
    const initialCardIndex = deck.cards.findIndex((card) => card.id === deck.activeCardId);
    return initialCardIndex >= 0 ? initialCardIndex : deck.cards.length ? 0 : -1;
  });
  const [transitionPhase, setTransitionPhase] = useState<CardTransitionPhase | null>(null);
  const [isFocusModeOpen, setIsFocusModeOpen] = useState(false);
  const [focusedTraversalDirection, setFocusedTraversalDirection] = useState<FocusedTraversalDirection>("next");
  const [isDeckIntroExpanded, setIsDeckIntroExpanded] = useState(false);
  const [deckIntroPlaybackState, setDeckIntroPlaybackState] = useState<VideoPlaybackState>("idle");
  const deckDetailRef = useRef<HTMLElement | null>(null);
  const deckSceneFrameRef = useRef<HTMLDivElement | null>(null);
  const introPlayerRef = useRef<CloudflareHlsVideoPlayerHandle | null>(null);
  const introActionRef = useRef<HTMLButtonElement | null>(null);
  const roleTransitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deckSceneLayout = useDeckSceneLayout(deckDetailRef, deckSceneFrameRef);
  // `deck` is the stable shell from the parent (identity/persistence fields remain authoritative).
  // `cards` is DeckDetail's optimistic local mutation source for step state.
  // Re-derive layout progress from local cards so progress text/strips update immediately,
  // while deck identity and persistence fields continue to come from `deck`.
  const optimisticDeck = useMemo(() => buildOptimisticDeckLayout(deck, cards), [deck, cards]);
  const deckIntroVideo = getPlayableDeckIntroductionVideo(optimisticDeck);
  const deckIntroVideoWidth = deckIntroVideo?.width ?? 9;
  const deckIntroVideoHeight = deckIntroVideo?.height ?? 16;
  const isDeckIntroPortrait = deckIntroVideoHeight > deckIntroVideoWidth;
  const finalCardIndex = optimisticDeck.cards.length - 1;
  const activeCard = optimisticDeck.cards[activeCardIndex];

  useEffect(() => {
    cardsRef.current = cards;
    if (deck.dataOwnerUserId) workingCardStore.accept(deck.dataOwnerUserId, cards);
  }, [cards, deck.dataOwnerUserId]);

  useEffect(() => {
    return () => {
      if (roleTransitionTimeoutRef.current) {
        clearTimeout(roleTransitionTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isDeckIntroExpanded) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      console.log("[DIAG DECKDETAIL] Escape key pressed while intro expanded, calling pausePlayback");
      introPlayerRef.current?.pausePlayback("deckdetail: escape key");
      setIsDeckIntroExpanded(false);
      introActionRef.current?.focus();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDeckIntroExpanded]);

  const handleDeckIntroPlaybackStateChange = useCallback(({ assetId, state }: { assetId: string | null; state: VideoPlaybackState }) => {
    console.log("[DIAG DECKDETAIL] onPlaybackStateChange", { assetId, state });
    setDeckIntroPlaybackState(state);
  }, []);

  const commitActiveCardIndex = (nextCardIndex: number) => {
    if (!cards[nextCardIndex]) return;
    if (nextCardIndex === activeCardIndex) {
      return;
    }

    const nextActiveCardId = cards[nextCardIndex]?.id;

    if (!nextActiveCardId) {
      setActiveCardIndex(nextCardIndex);
      return;
    }

    setActiveCardIndex(nextCardIndex);

    if (!deck.hasUserDeckData || !canMutate) {
      return;
    }

    void saveField(`deck:${deck.deckTemplateId}:active`, activeCardIndex, nextCardIndex,
      () => persistActiveCardId(deck.deckTemplateId, nextActiveCardId), setActiveCardIndex);
  };

  const moveActiveCard = (nextCardIndex: number) => {
    if (!cards[nextCardIndex]) return;
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
    if (!cards[cardIndex]) return;
    if (isDeckIntroExpanded) {
      console.log("[DIAG DECKDETAIL] focus mode opened while intro expanded, calling pausePlayback");
      introPlayerRef.current?.pausePlayback("deckdetail: focus mode opened, closing intro overlay");
      setIsDeckIntroExpanded(false);
    }
    commitActiveCardIndex(cardIndex);
    setIsFocusModeOpen(true);
  };

  const closeFocusMode = () => {
    setIsFocusModeOpen(false);
  };

  const openDeckIntroViewer = () => {
    console.log("[DIAG DECKDETAIL] Intro button clicked", {
      deckId: deck.id,
      deckTitle: deck.title,
      hasDeckIntroVideo: Boolean(deckIntroVideo),
      mediaType: deckIntroVideo?.mediaType ?? null,
      provider: deckIntroVideo?.provider ?? null,
      assetId: deckIntroVideo?.assetId ?? null,
      src: deckIntroVideo?.src ?? null,
      introPlayerRefExists: Boolean(introPlayerRef.current),
    });

    if (!deckIntroVideo || isFocusModeOpen) {
      console.log("[DIAG DECKDETAIL] Intro click ignored", {
        hasDeckIntroVideo: Boolean(deckIntroVideo),
        isFocusModeOpen,
      });
      return;
    }

    if (deckIntroPlaybackState === "ended") {
      console.log("[DIAG DECKDETAIL] calling pauseAndReset before replay (intro previously ended)");
      introPlayerRef.current?.pauseAndReset("deckdetail: intro previously ended, resetting before replay");
    }

    const player = introPlayerRef.current;

    console.log("[DIAG DECKDETAIL] calling loadMedia", {
      assetId: deckIntroVideo.assetId,
      src: deckIntroVideo.src,
      shouldPlay: true,
      playerExists: Boolean(player),
    });

    player?.loadMedia(deckIntroVideo, { shouldPlay: true });
    setIsDeckIntroExpanded(true);
  };

  const closeDeckIntroViewer = () => {
    console.log("[DIAG DECKDETAIL] closeDeckIntroViewer called, calling pausePlayback");
    introPlayerRef.current?.pausePlayback("deckdetail: close intro viewer");
    setIsDeckIntroExpanded(false);
    introActionRef.current?.focus();
  };

  const moveFocusedCard = (nextCardIndex: number) => {
    if (!cards[nextCardIndex]) return;
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

  function updatePersonalCard(cardId: string, change: (card: typeof cards[number]) => typeof cards[number]) {
    const next = cardsRef.current.map((card) => card.id === cardId ? change(card) : card);
    cardsRef.current = next; setCards(next);
  }
  async function saveField<T>(key: string, previous: T, next: T, persist: () => Promise<unknown>, rollback: (value: T) => void) {
    if (!confirmedFields.current.has(key)) confirmedFields.current.set(key, previous);
    const token = Symbol(); fieldTokens.current.set(key, token);
    try { await persist(); confirmedFields.current.set(key, next); }
    catch (error) {
      if (fieldTokens.current.get(key) === token) rollback(confirmedFields.current.get(key) as T);
      setMutationError(error instanceof Error ? error.message : "Change could not be saved");
    }
  }
  const cycleFocusedStepStatus = (stepId: string) => {
    if (!canMutate) {
      return;
    }

    const activeCard = cards[activeCardIndex];

    if (!activeCard) {
      return;
    }

    const currentStep = cardsRef.current.find((card) => card.id === activeCard.id)?.steps.find((step) => step.stepId === stepId);

    if (!currentStep) {
      return;
    }

    const nextCompletionStatus = getNextCompletionStatus(normalizeCompletionStatus(currentStep.completionStatus));

    const optimistic = cardsRef.current.map((card, cardIndex) => {
        if (cardIndex !== activeCardIndex) {
          return card;
        }

        return {
          ...card,
          steps: card.steps.map((step) =>
            step.stepId === stepId
              ? { ...step, completionStatus: nextCompletionStatus }
              : step
          ),
        };
      });
    cardsRef.current = optimistic; setCards(optimistic);

    if (!deck.hasUserDeckData) {
      return;
    }

    void saveField(`${activeCard.id}:completion:${stepId}`, currentStep.completionStatus, nextCompletionStatus,
      () => persistStepCompletionStatus(deck.deckTemplateId, activeCard.id, stepId, nextCompletionStatus),
      (value) => updatePersonalCard(activeCard.id, (card) => ({ ...card, steps: card.steps.map((step) => step.stepId === stepId ? { ...step, completionStatus: value } : step) })));

  };
  const adjustFocusedCardTargetDate = (direction: -1 | 1) => {
    if (!deck.hasUserDeckData || !canMutate) {
      return;
    }

    const activeCard = cardsRef.current[activeCardIndex];

    if (!activeCard) {
      return;
    }

    const nextTargetDate = addDaysToDateString(activeCard.targetDate, direction);

    if (!nextTargetDate) {
      console.warn("Unable to adjust card target date.");
      return;
    }

    const nextCards = cardsRef.current.map((card, cardIndex) =>
      cardIndex === activeCardIndex
        ? {
            ...card,
            targetDate: nextTargetDate,
          }
        : card,
    );

    cardsRef.current = nextCards;
    setCards(nextCards);

    void saveField(`${activeCard.id}:date`, activeCard.targetDate, nextTargetDate,
      () => persistCardTargetDate(deck.deckTemplateId, activeCard.id, nextTargetDate),
      (value) => updatePersonalCard(activeCard.id, (card) => ({ ...card, targetDate: value })));

  };
  const optimisticSignalManagerRef = useRef<OptimisticSignalManager | null>(null);
  if (optimisticSignalManagerRef.current === null) {
    optimisticSignalManagerRef.current = new OptimisticSignalManager(
      async (cardId: string, signalId: string, reading: number) => {
        await persistSignalReading(deck.deckTemplateId, cardId, signalId, reading);
      },
      (cardId: string, signalId: string, restored) => {
        setCards((currentCards) => {
          const revertedCards = currentCards.map((c) =>
            c.id === cardId
              ? withUpdatedSignalReading(c, signalId, restored.rawReading)
              : c
          );
          cardsRef.current = revertedCards;
          return revertedCards;
        });
      }
    );
  }

  const commitFocusedSignalReading = (cardId: string, signalId: string, reading: number) => {
    if (!canMutate) {
      return;
    }

    const nextReading = roundSignalReadingForStorage(reading);
    const manager = optimisticSignalManagerRef.current!;

    // Capture baseline before optimistic update
    const currentCard = cardsRef.current.find((c) => c.id === cardId);
    const currentSignal = currentCard?.signals.find((s) => s.id === signalId);
    manager.getConfirmedSignal(cardId, signalId, currentSignal?.reading ?? null, currentSignal?.rawReading ?? null);

    const nextCards = cardsRef.current.map((card) =>
      card.id === cardId ? withUpdatedSignalReading(card, signalId, nextReading) : card
    );

    cardsRef.current = nextCards;
    setCards(nextCards);

    if (!deck.hasUserDeckData) {
      return;
    }

    manager.setOptimisticReading(cardId, signalId, nextReading);
  };
  const commitFocusedReflection = async (cardId: string, reflection: string) => {
    if (!canMutate || !deck.hasUserDeckData) {
      throw new Error("Unable to save reflection for this deck.");
    }

    const normalizedReflection = reflection.trim();
    const previousCards = cardsRef.current;
    const nextCards = previousCards.map((card) =>
      card.id === cardId ? withUpdatedReflection(card, normalizedReflection) : card
    );

    cardsRef.current = nextCards;
    setCards(nextCards);

    try {
      await persistCardReflection(deck.deckTemplateId, cardId, normalizedReflection);
    } catch (error) {
      updatePersonalCard(cardId, (card) => withUpdatedReflection(card, previousCards.find((item) => item.id === cardId)?.reflection ?? ""));
      throw error;
    }
  };
  const applyConfirmedCardMedia = (
    cardId: string,
    mediaItems: MediaItem[],
  ) => {
    const nextCards = cardsRef.current.map((card) =>
      card.id === cardId ? withCardMediaItems(card, mediaItems) : card,
    );

    cardsRef.current = nextCards;
    setCards((currentCards) => currentCards.map((card) =>
      card.id === cardId ? withCardMediaItems(card, mediaItems) : card,
    ));
  };
  const commitFocusedCardMedia = async (target: UserCardMediaUploadTarget, mediaItem: ModernUserCardMediaItem) => {
    if (!canMutate || !deck.hasUserDeckData) {
      throw new Error("Unable to save media for this deck.");
    }

    if (target.deckTemplateId !== deck.deckTemplateId) {
      throw new Error("Unable to save media for this deck.");
    }

    await cardMediaMutationQueueRef.current!.enqueue(target, async () => {
      const result = await appendCardMediaItem(target.deckTemplateId, target.cardId, mediaItem);

      if (result.deckTemplateId !== target.deckTemplateId || result.cardId !== target.cardId) {
        throw new Error("Card media was saved to an unexpected card.");
      }

      applyConfirmedCardMedia(target.cardId, result.mediaItems);
    });
  };
  const removeFocusedCardMedia = async (target: UserCardMediaUploadTarget, mediaItemId: string) => {
    if (!canMutate || !deck.hasUserDeckData) {
      throw new Error("Unable to remove media from this deck.");
    }

    if (target.deckTemplateId !== deck.deckTemplateId) {
      throw new Error("Unable to remove media from this deck.");
    }

    await cardMediaMutationQueueRef.current!.enqueue(target, async () => {
      const result = await removePersonalCardMediaItem(target.cardId, mediaItemId);

      if (result.cardId !== target.cardId) {
        throw new Error("Card media was removed from an unexpected card.");
      }

      const nextCards = cardsRef.current.map((card) => withCardMediaItems({ ...card,
        personalHistory: card.personalHistory?.map((segment) => segment.cardTemplateId === target.cardId
          ? { ...segment, mediaItems: result.mediaItems } : segment),
      }, card.id === target.cardId ? result.mediaItems : card.mediaItems));
      workingCardStore.removeMedia(deck.dataOwnerUserId!, target.cardId, mediaItemId);
      cardsRef.current = nextCards;
      setCards(nextCards);
    });
  };
  const toggleDeckSide = (commitment: GestureCommitment, vector: GestureVector) => {
    const directionDelta = commitment.direction === "right" || (!commitment.direction && vector.x > 0) ? 180 : -180;

    onToggleDeckFlip(directionDelta);
  };
  const deckGestures = useDeckGestures({
    mode: "deck",
    allowedIntents: ["settleToPast", "restoreFromPast", "flip"],
    locked: !activeCard || transitionPhase !== null || isFocusModeOpen,
    onSettleToPast: goToNextCard,
    onRestoreFromPast: goToPreviousCard,
    onFlip: toggleDeckSide,
  });
  const latestPastGestures = useDeckGestures({
    mode: "deck",
    allowedIntents: ["restoreFromPast"],
    locked: !activeCard || transitionPhase !== null || isFocusModeOpen || activeCardIndex === 0,
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
      {mutationError && <p role="alert">{mutationError}</p>}
      {deck.permissions?.canEditDeck && <DeckMenu deckId={deck.id} deckTemplateId={deck.deckTemplateId} />}

      <motion.div className="detail-heading" layout>
        <div className="detail-progress-row">
          <p className="detail-progress">{Math.round(optimisticDeck.progressPercentage) === 100 ? "Completed" : `Completion ${Math.round(optimisticDeck.progressPercentage)}%`}</p>
          {optimisticDeck.confidenceScore !== null && (
            <p className="detail-confidence">Confidence {optimisticDeck.confidenceScore}</p>
          )}
          {deckIntroVideo && !isFocusModeOpen ? (
            <button
              ref={introActionRef}
              className="deck-intro-action"
              onClick={openDeckIntroViewer}
              type="button"
              aria-label={`Play introduction video for ${deck.title}`}
            >
              <span aria-hidden="true">&#9654;</span>
              <span>Intro</span>
            </button>
          ) : null}
        </div>
        <h1>{deck.title}</h1>
      </motion.div>

      {optimisticDeck.cards.length > 0 ? <div
        ref={deckSceneFrameRef}
        className="deck-scene-frame"
        style={deckSceneLayout.frameHeight === null ? undefined : { height: deckSceneLayout.frameHeight }}
      >
        <div className="deck-scene-scaler" style={{ transform: `scale(${deckSceneLayout.scale})` }}>
          <CardStack
            cards={optimisticDeck.cards}
            deckTemplateId={deck.deckTemplateId}
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
      </div> : null}

      <AnimatePresence>
        {isFocusModeOpen && activeCard ? (
          <FocusedCardView
            card={activeCard}
            cardIndex={activeCardIndex}
            canMutate={canMutate}
            deckTemplateId={deck.deckTemplateId}
            totalCards={optimisticDeck.cards.length}
            onClose={closeFocusMode}
            onPrevious={goToPreviousFocusedCard}
            onNext={goToNextFocusedCard}
            onCycleStepStatus={cycleFocusedStepStatus}
            onAdjustTargetDate={adjustFocusedCardTargetDate}
            onCommitSignalReading={commitFocusedSignalReading}
            onCommitReflection={canMutate && deck.hasUserDeckData ? commitFocusedReflection : undefined}
            onCommitCardMedia={canMutate && deck.hasUserDeckData ? commitFocusedCardMedia : undefined}
            onRemoveCardMedia={canMutate && deck.hasUserDeckData ? removeFocusedCardMedia : undefined}
            isDeckFlipped={isDeckFlipped}
            traversalDirection={focusedTraversalDirection}
            transition={transition}
          />
        ) : null}
      </AnimatePresence>

      {deckIntroVideo ? (
        <div className={`deck-intro-viewer-layer${isDeckIntroExpanded ? " deck-intro-viewer-layer--visible" : ""}`} aria-hidden={!isDeckIntroExpanded}>
          {isDeckIntroExpanded ? <div className="deck-intro-viewer-backdrop" /> : null}
          <div
            className={`deck-intro-viewer-host${isDeckIntroExpanded ? " deck-intro-viewer-host--expanded" : ""}${
              isDeckIntroPortrait ? " deck-intro-viewer-host--portrait" : " deck-intro-viewer-host--landscape"
            }`}
          >
            <div
              className={`deck-intro-viewer-frame${isDeckIntroExpanded ? " deck-intro-viewer-frame--expanded" : ""}`}
              style={
                  deckIntroVideo
                  ? {
                      aspectRatio: `${deckIntroVideoWidth} / ${deckIntroVideoHeight}`,
                    }
                  : undefined
              }
            >
              <CloudflareHlsVideoPlayer
                ref={introPlayerRef}
                displayMode={isDeckIntroExpanded ? "expanded" : "embedded"}
                mediaItem={null}
                onPlaybackStateChange={handleDeckIntroPlaybackStateChange}
                onRequestCollapse={isDeckIntroExpanded ? closeDeckIntroViewer : undefined}
                onRequestExpand={!isDeckIntroExpanded && deckIntroVideo ? openDeckIntroViewer : undefined}
                previewLabel={`introduction for ${deck.title}`}
                variant="standard"
              />
            </div>
          </div>
        </div>
      ) : null}


    </motion.section>
  );
}

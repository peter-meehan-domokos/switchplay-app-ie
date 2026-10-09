"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { AnimatePresence, motion } from "motion/react";
import { publishedVideoGuard } from "@/components/media/publishedVideo";
import CardStack, { type CardTransitionPhase } from "./CardStack";
import { getPlayableDeckIntroductionVideo } from "./deckIntroPreview";
import FocusedCardView, { type FocusedCardViewProps, type FocusedTraversalDirection } from "./FocusedCardView";
import { deckPresentationIdentity, hasPersonalDeck, type PresentedDeck, type PresentedCard, type CardBackPresentation } from "./presentation";
import { DECK_GESTURE_THRESHOLDS } from "./gestures/gestureThresholds";
import { useDeckGestures } from "./gestures/useDeckGestures";
import type { GestureCommitment, GestureVector } from "./gestures/gestureTypes";
import CloudflareHlsVideoPlayer, { type CloudflareHlsVideoPlayerHandle, type VideoPlaybackState } from "@/components/media/CloudflareHlsVideoPlayer";
import { DECK_SCENE_BASELINE_HEIGHT, DECK_SCENE_BASELINE_WIDTH, DECK_SCENE_BOTTOM_CROP_ALLOWANCE, ROLE_TRANSITION_SETTLE_MS } from "@/constants/cardStack";
import type { ReactNode } from "react";

export type DeckSceneProps = {
  renderCardBackFace?: CardBackPresentation;
  deck: PresentedDeck;
  isDeckFlipped?: boolean;
  deckFlipRotationY?: number;
  onBack: () => void;
  onToggleDeckFlip?: (rotationDelta?: number) => void;
  transition: object;
  error?: string;
  deckActions?: ReactNode;
  cardActions?: (card: PresentedCard) => ReactNode;
  onActiveCardChange?: (previous: number, next: number, rollback: (index: number) => void) => void;
  renderFocusedCard?: (props: FocusedCardViewProps) => ReactNode;
};

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

// Replacing a Deck/immutable selection uses deckPresentationIdentity as the
// caller's React key. Optimistic personal changes preserve that key and player lifetime.
export default function DeckScene({ deck, isDeckFlipped = false, deckFlipRotationY = 0, onBack, onToggleDeckFlip, transition, error, deckActions, cardActions, onActiveCardChange, renderFocusedCard, renderCardBackFace }: DeckSceneProps) {
  const canonicalVersion = hasPersonalDeck(deck) ? null : deck.version;
  const videoGuard = useMemo(() => canonicalVersion === null ? undefined : publishedVideoGuard("deck", deck.deckTemplateId, canonicalVersion), [deck.deckTemplateId, canonicalVersion]);
  const cards = deck.cards;
  const [activeCardIndex, setActiveCardIndex] = useState(() => {
    const initialCardIndex = hasPersonalDeck(deck) ? deck.cards.findIndex((card) => card.id === deck.activeCardId) : -1;
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
  const optimisticDeck = deck;
  const deckIntroVideo = getPlayableDeckIntroductionVideo(optimisticDeck);
  const deckIntroVideoWidth = deckIntroVideo?.width ?? 9;
  const deckIntroVideoHeight = deckIntroVideo?.height ?? 16;
  const isDeckIntroPortrait = deckIntroVideoHeight > deckIntroVideoWidth;
  const finalCardIndex = optimisticDeck.cards.length - 1;
  const activeCard = optimisticDeck.cards[activeCardIndex];

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

    onActiveCardChange?.(activeCardIndex, nextCardIndex, setActiveCardIndex);
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

  const toggleDeckSide = (commitment: GestureCommitment, vector: GestureVector) => {
    const directionDelta = commitment.direction === "right" || (!commitment.direction && vector.x > 0) ? 180 : -180;

    onToggleDeckFlip?.(directionDelta);
  };
  const deckGestures = useDeckGestures({
    mode: "deck",
    allowedIntents: onToggleDeckFlip ? ["settleToPast", "restoreFromPast", "flip"] : ["settleToPast", "restoreFromPast"],
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
      layoutId={`deck-${deckPresentationIdentity(deck)}`}
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
      {error && <p role="alert">{error}</p>}
      {deckActions}

      <motion.div className="detail-heading" layout>
        <div className="detail-progress-row">
          {hasPersonalDeck(optimisticDeck) ? <p className="detail-progress">{Math.round(optimisticDeck.progressPercentage) === 100 ? "Completed" : `Completion ${Math.round(optimisticDeck.progressPercentage)}%`}</p> : <p className="detail-progress personal-layout-slot" aria-hidden="true" />}
          {hasPersonalDeck(optimisticDeck) && optimisticDeck.confidenceScore !== null && (
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
            renderBackFace={renderCardBackFace}
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

      {!isFocusModeOpen && activeCard && cardActions ? <div className="deck-card-actions">{cardActions(activeCard)}</div> : null}

      <AnimatePresence>
        {isFocusModeOpen && activeCard ? (
          renderFocusedCard ? renderFocusedCard({
            card: activeCard, cardIndex: activeCardIndex, deckTemplateId: deck.deckTemplateId,
            totalCards: cards.length, onClose: closeFocusMode, onPrevious: goToPreviousFocusedCard,
            onNext: goToNextFocusedCard, isDeckFlipped, traversalDirection: focusedTraversalDirection, transition,
          }) : <FocusedCardView card={activeCard} cardIndex={activeCardIndex} deckTemplateId={deck.deckTemplateId}
            totalCards={cards.length} onClose={closeFocusMode} onPrevious={goToPreviousFocusedCard}
            onNext={goToNextFocusedCard} isDeckFlipped={isDeckFlipped}
            traversalDirection={focusedTraversalDirection} transition={transition} />
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
                beforeLoad={videoGuard}
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

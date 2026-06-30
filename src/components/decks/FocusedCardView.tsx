import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type PointerEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Transition } from "motion/react";
import ActiveCardFront from "@/components/cards/ActiveCardFront";
import type { CardLayout } from "@/components/cards/cardLayout";
import BackCardFaceContent from "@/components/decks/BackCardFaceContent";
import CloudflareStreamPlayer from "@/components/media/CloudflareStreamPlayer";
import StepView, { type StepViewItem } from "@/components/decks/StepView";
import { useDeckGestures } from "@/components/decks/gestures/useDeckGestures";
import type { GestureCommitment, GestureVector } from "@/components/decks/gestures/gestureTypes";
import {
  isCloudflareStreamVideoMediaItem,
  isKnownPortraitCloudflareStreamVideoMediaItem,
  type CloudflareStreamVideoMediaItem,
  type MediaItem,
} from "@/lib/media";
import {
  CARD_ASPECT_RATIO,
  CARD_HEIGHT_RATIO,
  FOCUSED_CARD_BASELINE_WIDTH,
  FOCUSED_CARD_HORIZONTAL_PADDING,
  FOCUSED_CARD_MAX_VISUAL_WIDTH,
  FOCUSED_CARD_MIN_VISUAL_WIDTH,
  FOCUSED_CARD_PREFERRED_VISUAL_WIDTH,
  FOCUSED_CARD_STAGE_WIDTH,
  FOCUSED_CARD_VERTICAL_PADDING,
} from "@/constants/cardStack";

type FocusedCardViewProps = {
  card: CardLayout;
  cardIndex: number;
  isDeckFlipped: boolean;
  totalCards: number;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onCycleStepStatus: (stepId: string) => void;
  onAdjustTargetDate: (direction: -1 | 1) => void;
  onCommitSignalReading: (cardId: string, signalId: string, reading: number) => void;
  onCommitReflection?: (cardId: string, reflection: string) => Promise<void>;
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

type StepViewState = {
  cardId: string;
  itemIndex: number;
};

type ReflectionEditorState = {
  cardId: string;
};

type VideoHostRect = {
  height: number;
  left: number;
  top: number;
  width: number;
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
});

const FOCUSED_FLIP_LOCK_MS = 680;
const FOCUSED_TRAVERSAL_LOCK_MS = 280;
const FALLBACK_FOCUSED_CARD_SCALE = FOCUSED_CARD_PREFERRED_VISUAL_WIDTH / FOCUSED_CARD_BASELINE_WIDTH;
const REFLECTION_DISPLAY_RECOMMENDED_CHARS = 55;

function getDeckFlipSide(isDeckFlipped: boolean): FocusedFlipSide {
  return isDeckFlipped ? "back" : "front";
}

function getDeckFlipRotation(isDeckFlipped: boolean) {
  return isDeckFlipped ? 180 : 0;
}

function getStepViewSequence(card: CardLayout): StepViewItem[] {
  return [
    { type: "intro" },
    ...card.steps.map((_, stepIndex) => ({ type: "step" as const, stepIndex })),
  ];
}

function getStepViewMediaItem(card: CardLayout, item: StepViewItem): MediaItem | null {
  return item.type === "intro" ? card.intro.mediaItem ?? null : card.steps[item.stepIndex]?.mediaItem ?? null;
}

function toVideoHostRect(rect: DOMRect): VideoHostRect {
  return {
    height: rect.height,
    left: rect.left,
    top: rect.top,
    width: rect.width,
  };
}

function isVideoHostRectEqual(currentRect: VideoHostRect | null, nextRect: VideoHostRect) {
  if (!currentRect) {
    return false;
  }

  const epsilon = 0.5;

  return (
    Math.abs(currentRect.left - nextRect.left) <= epsilon &&
    Math.abs(currentRect.top - nextRect.top) <= epsilon &&
    Math.abs(currentRect.width - nextRect.width) <= epsilon &&
    Math.abs(currentRect.height - nextRect.height) <= epsilon
  );
}

function isValidVideoHostRect(rect: VideoHostRect) {
  return Number.isFinite(rect.left) && Number.isFinite(rect.top) && rect.width > 1 && rect.height > 1;
}

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

function getViewportSize() {
  if (typeof window === "undefined") {
    return null;
  }

  return {
    width: window.visualViewport?.width ?? window.innerWidth,
    height: window.visualViewport?.height ?? window.innerHeight,
  };
}

function getFocusedCardScale(viewportSize: { width: number; height: number } | null) {
  if (!viewportSize) {
    return FALLBACK_FOCUSED_CARD_SCALE;
  }

  const availableWidth = Math.max(0, viewportSize.width - FOCUSED_CARD_HORIZONTAL_PADDING);
  const availableHeight = Math.max(0, viewportSize.height - FOCUSED_CARD_VERTICAL_PADDING);
  const heightConstrainedWidth = availableHeight / CARD_HEIGHT_RATIO;
  const fitVisualWidth = Math.min(
    FOCUSED_CARD_PREFERRED_VISUAL_WIDTH,
    FOCUSED_CARD_MAX_VISUAL_WIDTH,
    availableWidth,
    heightConstrainedWidth
  );
  const minReadableWidth = Math.min(FOCUSED_CARD_MIN_VISUAL_WIDTH, availableWidth, heightConstrainedWidth);
  const focusedVisualWidth = Math.max(minReadableWidth, fitVisualWidth);

  return focusedVisualWidth / FOCUSED_CARD_BASELINE_WIDTH;
}

function useFocusedCardScale() {
  const [focusedCardScale, setFocusedCardScale] = useState(() => getFocusedCardScale(getViewportSize()));

  useEffect(() => {
    const updateFocusedCardScale = () => {
      setFocusedCardScale(getFocusedCardScale(getViewportSize()));
    };

    updateFocusedCardScale();
    window.addEventListener("resize", updateFocusedCardScale);
    window.visualViewport?.addEventListener("resize", updateFocusedCardScale);

    return () => {
      window.removeEventListener("resize", updateFocusedCardScale);
      window.visualViewport?.removeEventListener("resize", updateFocusedCardScale);
    };
  }, []);

  return focusedCardScale;
}

export default function FocusedCardView({
  card,
  cardIndex,
  isDeckFlipped,
  totalCards,
  onClose,
  onPrevious,
  onNext,
  onCycleStepStatus,
  onAdjustTargetDate,
  onCommitSignalReading,
  onCommitReflection,
  traversalDirection,
  transition,
}: FocusedCardViewProps) {
  const [flipState, setFlipState] = useState<FocusedFlipState>({
    cardId: card.id,
    side: isDeckFlipped ? "back" : "front",
    rotationY: isDeckFlipped ? 180 : 0,
  });
  const [stepViewState, setStepViewState] = useState<StepViewState | null>(null);
  const [reflectionEditorState, setReflectionEditorState] = useState<ReflectionEditorState | null>(null);
  const [reflectionDraftValue, setReflectionDraftValue] = useState("");
  const [reflectionEditorError, setReflectionEditorError] = useState<string | null>(null);
  const [isSavingReflection, setIsSavingReflection] = useState(false);
  const [isVideoExpanded, setIsVideoExpanded] = useState(false);
  const [videoAnchorElement, setVideoAnchorElement] = useState<HTMLDivElement | null>(null);
  const [videoHostRect, setVideoHostRect] = useState<VideoHostRect | null>(null);
  const [isFocusedGestureLocked, setIsFocusedGestureLocked] = useState(false);
  const focusedGestureLockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusedCardScale = useFocusedCardScale();
  const deckSideFlipState: FocusedFlipState = {
    cardId: card.id,
    side: getDeckFlipSide(isDeckFlipped),
    rotationY: getDeckFlipRotation(isDeckFlipped),
  };
  const cardFlipState = flipState.cardId === card.id ? flipState : deckSideFlipState;
  const isFlipped = cardFlipState.side === "back";
  const stepViewSequence = getStepViewSequence(card);
  const stepViewItemIndex =
    stepViewState?.cardId === card.id && !isFlipped
      ? Math.min(stepViewState.itemIndex, stepViewSequence.length - 1)
      : null;
  const stepViewItem = stepViewItemIndex === null ? null : stepViewSequence[stepViewItemIndex] ?? null;
  const activeStepViewMediaItem = stepViewItem ? getStepViewMediaItem(card, stepViewItem) : null;
  const activeCloudflareVideoMediaItem =
    activeStepViewMediaItem && isCloudflareStreamVideoMediaItem(activeStepViewMediaItem)
      ? activeStepViewMediaItem
      : null;
  const isExpandedVideoPortrait =
    activeCloudflareVideoMediaItem ? isKnownPortraitCloudflareStreamVideoMediaItem(activeCloudflareVideoMediaItem) : false;
  const isVideoHostVisible = Boolean(activeCloudflareVideoMediaItem && (isVideoExpanded || videoHostRect));
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
        currentFlipState.cardId === card.id ? currentFlipState : deckSideFlipState;
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
  const openStepView = (stepIndex: number) => {
    if (isFlipped) {
      return;
    }

    setStepViewState({
      cardId: card.id,
      itemIndex: stepIndex + 1,
    });
  };
  const openIntroView = () => {
    if (isFlipped) {
      return;
    }

    setStepViewState({
      cardId: card.id,
      itemIndex: 0,
    });
  };
  const openReflectionEditor = (cardId: string) => {
    if (!onCommitReflection || !isFlipped) {
      return;
    }

    setReflectionEditorState({
      cardId,
    });
    setReflectionDraftValue(card.reflection);
    setReflectionEditorError(null);
  };
  const closeReflectionEditor = () => {
    if (isSavingReflection) {
      return;
    }

    setReflectionEditorState(null);
    setReflectionEditorError(null);
  };
  const stopReflectionEditorGesturePropagation = (event: PointerEvent<HTMLFormElement>) => {
    event.stopPropagation();
  };
  const submitReflectionEditor = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!reflectionEditorState || !onCommitReflection) {
      return;
    }

    setIsSavingReflection(true);
    setReflectionEditorError(null);

    try {
      await onCommitReflection(reflectionEditorState.cardId, reflectionDraftValue);
      setReflectionEditorState(null);
    } catch (error) {
      console.warn("Unable to persist card reflection.", error);
      setReflectionEditorError(error instanceof Error ? error.message : "Unable to save reflection.");
    } finally {
      setIsSavingReflection(false);
    }
  };
  const closeStepView = () => {
    setIsVideoExpanded(false);
    setVideoHostRect(null);
    setVideoAnchorElement(null);
    setStepViewState(null);
  };
  const goToPreviousStepViewItem = () => {
    setIsVideoExpanded(false);
    setStepViewState((currentStepViewState) => {
      if (!currentStepViewState || currentStepViewState.cardId !== card.id) {
        return currentStepViewState;
      }

      return {
        ...currentStepViewState,
        itemIndex: Math.max(0, currentStepViewState.itemIndex - 1),
      };
    });
  };
  const goToNextStepViewItem = () => {
    setIsVideoExpanded(false);
    setStepViewState((currentStepViewState) => {
      if (!currentStepViewState || currentStepViewState.cardId !== card.id) {
        return currentStepViewState;
      }

      return {
        ...currentStepViewState,
        itemIndex: Math.min(stepViewSequence.length - 1, currentStepViewState.itemIndex + 1),
      };
    });
  };
  const handleVideoAnchorRef = useCallback((nextAnchorElement: HTMLDivElement | null) => {
    // Ignore transient null callbacks during re-render so the hosted player remains mounted.
    if (!nextAnchorElement) {
      return;
    }

    setVideoAnchorElement((currentAnchorElement) => (currentAnchorElement === nextAnchorElement ? currentAnchorElement : nextAnchorElement));
  }, []);
  const focusedGestures = useDeckGestures({
    mode: "focus",
    allowedIntents: ["settleToPast", "restoreFromPast", "flip"],
    locked: isFocusedGestureLocked || Boolean(stepViewItem) || Boolean(reflectionEditorState) || isVideoExpanded,
    onSettleToPast: settleFocusedCardToPast,
    onRestoreFromPast: restoreFocusedCardFromPast,
    onFlip: toggleFocusedCardSide,
  });

  useEffect(() => {
    if (!activeCloudflareVideoMediaItem) {
      setIsVideoExpanded(false);
      setVideoHostRect(null);
      setVideoAnchorElement(null);
    }
  }, [activeCloudflareVideoMediaItem]);

  useLayoutEffect(() => {
    if (!videoAnchorElement) {
      return;
    }

    let isDisposed = false;
    let animationFrameId: number | null = null;

    const updateVideoHostRect = () => {
      const nextRect = toVideoHostRect(videoAnchorElement.getBoundingClientRect());

      if (!isValidVideoHostRect(nextRect)) {
        return;
      }

      setVideoHostRect((currentRect) => (isVideoHostRectEqual(currentRect, nextRect) ? currentRect : nextRect));
    };

    const sampleVideoHostRect = () => {
      if (isDisposed) {
        return;
      }

      updateVideoHostRect();
      animationFrameId = window.requestAnimationFrame(sampleVideoHostRect);
    };

    updateVideoHostRect();
    animationFrameId = window.requestAnimationFrame(sampleVideoHostRect);

    const resizeObserver = new ResizeObserver(updateVideoHostRect);
    resizeObserver.observe(videoAnchorElement);
    window.addEventListener("resize", updateVideoHostRect);
    window.visualViewport?.addEventListener("resize", updateVideoHostRect);

    return () => {
      isDisposed = true;
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateVideoHostRect);
      window.visualViewport?.removeEventListener("resize", updateVideoHostRect);
    };
  }, [videoAnchorElement]);

  useEffect(() => {
    setFlipState({ cardId: card.id, side: getDeckFlipSide(isDeckFlipped), rotationY: getDeckFlipRotation(isDeckFlipped) });
    setIsVideoExpanded(false);
    setVideoHostRect(null);
    setVideoAnchorElement(null);
    setReflectionEditorState(null);
    setReflectionEditorError(null);
  }, [card.id]);

  useEffect(() => {
    setFlipState((currentFlipState) => {
      const targetSide = getDeckFlipSide(isDeckFlipped);

      if (currentFlipState.cardId !== card.id || currentFlipState.side === targetSide) {
        return currentFlipState;
      }

      return {
        cardId: card.id,
        side: targetSide,
        rotationY: currentFlipState.rotationY + (targetSide === "back" ? 180 : -180),
      };
    });
  }, [card.id, isDeckFlipped]);

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
          style={{ width: FOCUSED_CARD_STAGE_WIDTH, aspectRatio: CARD_ASPECT_RATIO }}
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
            initial={false}
            animate={{
              rotateY: cardFlipState.rotationY,
              scale: focusedCardScale,
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
                  onCycleStepStatus={onCycleStepStatus}
                  onAdjustTargetDate={onAdjustTargetDate}
                  onOpenIntroView={openIntroView}
                  onOpenStepView={openStepView}
                  onStepNavigateNext={settleFocusedCardToPast}
                  onStepNavigatePrevious={restoreFocusedCardFromPast}
                />
              </div>
            </div>
            <div className="physical-card focused-card-surface focused-card-surface--back" aria-hidden={!isFlipped} inert={!isFlipped}>
              <BackCardFaceContent
                card={card}
                dateLabel={dateLabel}
                variant="focused"
                onCommitSignalReading={onCommitSignalReading}
                onEditReflection={onCommitReflection ? openReflectionEditor : undefined}
                onSignalNavigateNext={settleFocusedCardToPast}
                onSignalNavigatePrevious={restoreFocusedCardFromPast}
              />
            </div>
            <AnimatePresence>
              {stepViewItem && stepViewItemIndex !== null ? (
                <StepView
                  key={`${card.id}:${stepViewItemIndex}`}
                  card={card}
                  cloudflareVideoAnchorRef={handleVideoAnchorRef}
                  item={stepViewItem}
                  itemIndex={stepViewItemIndex}
                  itemCount={stepViewSequence.length}
                  onClose={closeStepView}
                  onNext={goToNextStepViewItem}
                  onPrevious={goToPreviousStepViewItem}
                  useCloudflareVideoHost={Boolean(activeCloudflareVideoMediaItem)}
                />
              ) : null}
            </AnimatePresence>
          </motion.div>
        </motion.article>
      </AnimatePresence>
      {isVideoHostVisible && activeCloudflareVideoMediaItem ? (
        <div className="switchplay-video-host-layer" aria-hidden="true">
          <div
            className={`switchplay-video-host${
              isVideoExpanded ? " switchplay-video-host--expanded" : " switchplay-video-host--embedded"
            }${isExpandedVideoPortrait ? " switchplay-video-host--portrait" : " switchplay-video-host--landscape"}`}
            style={
              !isVideoExpanded && videoHostRect
                ? {
                    height: `${videoHostRect.height}px`,
                    left: `${videoHostRect.left}px`,
                    top: `${videoHostRect.top}px`,
                    width: `${videoHostRect.width}px`,
                  }
                : undefined
            }
          >
            <div className="switchplay-video-frame">
              <CloudflareStreamPlayer
                controlsMode="switchplay"
                displayMode={isVideoExpanded ? "expanded" : "embedded"}
                mediaItem={activeCloudflareVideoMediaItem}
                onRequestCollapse={() => {
                  setIsVideoExpanded(false);
                }}
                onRequestExpand={() => {
                  setIsVideoExpanded(true);
                }}
              />
            </div>
          </div>
        </div>
      ) : null}
      <AnimatePresence>
        {reflectionEditorState ? (
          <motion.div
            className="creator-modal-backdrop reflection-editor-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14 }}
            role="presentation"
          >
            <form
              className="creator-modal creator-modal--reflection-editor reflection-editor-modal"
              onPointerCancel={stopReflectionEditorGesturePropagation}
              onPointerDown={stopReflectionEditorGesturePropagation}
              onPointerMove={stopReflectionEditorGesturePropagation}
              onPointerUp={stopReflectionEditorGesturePropagation}
              onSubmit={submitReflectionEditor}
            >
              <header className="creator-modal-header">
                <p>Edit reflection</p>
                <button className="creator-modal-close" disabled={isSavingReflection} onClick={closeReflectionEditor} type="button">
                  Close
                </button>
              </header>
              <p className="creator-modal-note">Aim for about 9 words. Longer reflections may be truncated on the card.</p>
              <textarea
                autoFocus
                className="creator-modal-field creator-modal-field--reflection"
                onChange={(event) => setReflectionDraftValue(event.target.value)}
                value={reflectionDraftValue}
              />
              <p
                className={`creator-modal-counter${
                  reflectionDraftValue.length > REFLECTION_DISPLAY_RECOMMENDED_CHARS ? " creator-modal-counter--warning" : ""
                }`}
              >
                {reflectionDraftValue.length}/{REFLECTION_DISPLAY_RECOMMENDED_CHARS} recommended characters
              </p>
              {reflectionEditorError ? <p className="creator-modal-error">{reflectionEditorError}</p> : null}
              <div className="creator-modal-actions">
                <button className="creator-modal-secondary" disabled={isSavingReflection} onClick={closeReflectionEditor} type="button">
                  Cancel
                </button>
                <button className="creator-modal-primary" disabled={isSavingReflection} type="submit">
                  {isSavingReflection ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}

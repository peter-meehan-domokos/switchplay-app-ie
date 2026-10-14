import { cloneElement, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type ReactElement } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Transition } from "motion/react";
import { publishedVideoGuard } from "@/components/media/publishedVideo";
import ActiveCardFront from "@/components/cards/ActiveCardFront";
import CardCreatorAttribution from "@/components/cards/CardCreatorAttribution";
import { hasPersonalCard, cardPresentationIdentity, type PresentedCard } from "./presentation";
import CloudflareHlsVideoPlayer, { type CloudflareHlsVideoPlayerHandle, type VideoPlaybackIntent } from "@/components/media/CloudflareHlsVideoPlayer";
import StepView, { type StepViewItem } from "@/components/decks/StepView";
import { useDeckGestures } from "@/components/decks/gestures/useDeckGestures";
import type { GestureCommitment, GestureVector } from "@/components/decks/gestures/gestureTypes";
import { getCloudflareStreamThumbnailUrl } from "@/lib/cloudflareStreamPlayback";
import {
  isCloudflareStreamVideoMediaItem,
  isKnownLandscapeCloudflareStreamVideoMediaItem,
  isKnownPortraitCloudflareStreamVideoMediaItem,
  type MediaItem,
} from "@/lib/media";
import { dateOnlyToUtcDate } from "@/lib/dateOnly";
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

export type FocusedCardViewProps = {
  card: PresentedCard;
  cardIndex: number;
  deckTemplateId: string;
  isDeckFlipped: boolean;
  totalCards: number;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onCycleStepStatus?: (stepId: string) => void;
  onAdjustTargetDate?: (direction: -1 | 1) => void;
  backFace?: ReactElement<{ onSignalNavigateNext?: () => void; onSignalNavigatePrevious?: () => void }>;
  overlays?: ReactNode;
  assessment?: ReactNode;
  frontAction?: ReactNode;
  interactionLocked?: boolean;
  onRequestAddComment?: () => void;
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

function getDeckFlipSide(isDeckFlipped: boolean): FocusedFlipSide {
  return isDeckFlipped ? "back" : "front";
}

function getDeckFlipRotation(isDeckFlipped: boolean) {
  return isDeckFlipped ? 180 : 0;
}

function getStepViewSequence(card: PresentedCard): StepViewItem[] {
  return [
    { type: "intro" },
    ...card.steps.map((_, stepIndex) => ({ type: "step" as const, stepIndex })),
  ];
}

function getStepViewMediaItem(card: PresentedCard, item: StepViewItem): MediaItem | null {
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

function CardBackSlot({ content, onNext, onPrevious }: {
  content: NonNullable<FocusedCardViewProps["backFace"]>;
  onNext: () => void;
  onPrevious: () => void;
}) {
  return cloneElement(content, { onSignalNavigateNext: onNext, onSignalNavigatePrevious: onPrevious });
}

export default function FocusedCardView({
  card,
  cardIndex,
  isDeckFlipped: requestedDeckFlip,
  totalCards,
  onClose,
  onPrevious,
  onNext,
  onCycleStepStatus,
  onAdjustTargetDate,
  backFace,
  overlays,
  frontAction,
  assessment,
  interactionLocked = false,
  onRequestAddComment,
  traversalDirection,
  transition,
}: FocusedCardViewProps) {
  const canonicalVersion = hasPersonalCard(card) ? null : card.version;
  const videoGuard = useMemo(() => canonicalVersion === null ? undefined : publishedVideoGuard("card", card.cardTemplateId!, canonicalVersion), [card.cardTemplateId, canonicalVersion]);
  const isDeckFlipped = Boolean(backFace) && requestedDeckFlip;
  const contentIdentity = cardPresentationIdentity(card);
  const [flipState, setFlipState] = useState<FocusedFlipState>({
    cardId: card.id,
    side: isDeckFlipped ? "back" : "front",
    rotationY: isDeckFlipped ? 180 : 0,
  });
  const [stepViewState, setStepViewState] = useState<StepViewState | null>(null);
  const [isVideoExpanded, setIsVideoExpanded] = useState(false);
  const [videoAnchorElement, setVideoAnchorElement] = useState<HTMLDivElement | null>(null);
  const [videoHostRect, setVideoHostRect] = useState<VideoHostRect | null>(null);
  const [expandedLandscapeFrameSize, setExpandedLandscapeFrameSize] = useState<{ width: number; height: number } | null>(null);
  const [renderableVideoAssetId, setRenderableVideoAssetId] = useState<string | null>(null);
  const [failedVideoAssetId, setFailedVideoAssetId] = useState<string | null>(null);
  const [failedVideoPosterSrc, setFailedVideoPosterSrc] = useState<string | null>(null);
  const [fadingPosterAssetId, setFadingPosterAssetId] = useState<string | null>(null);
  const [isFocusedGestureLocked, setIsFocusedGestureLocked] = useState(false);
  const focusedGestureLockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoHostElementRef = useRef<HTMLDivElement | null>(null);
  const videoFrameElementRef = useRef<HTMLDivElement | null>(null);
  const videoPlayerRef = useRef<CloudflareHlsVideoPlayerHandle | null>(null);
  const stepViewStateRef = useRef<StepViewState | null>(null);
  const videoPlaybackIntentRef = useRef<VideoPlaybackIntent>("idle");
  const activeVideoAssetIdRef = useRef<string | null>(null);
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
  const isExpandedVideoLandscape =
    activeCloudflareVideoMediaItem ? isKnownLandscapeCloudflareStreamVideoMediaItem(activeCloudflareVideoMediaItem) : false;
  const activeVideoAssetId = activeCloudflareVideoMediaItem?.assetId ?? null;
  const activeVideoPosterSrc = activeCloudflareVideoMediaItem ? getCloudflareStreamThumbnailUrl(activeCloudflareVideoMediaItem) : null;
  const hasPosterFallback = Boolean(activeVideoPosterSrc && failedVideoPosterSrc !== activeVideoPosterSrc);
  const isCurrentVideoRenderable = Boolean(activeVideoAssetId && renderableVideoAssetId === activeVideoAssetId);
  const isCurrentVideoFailed = Boolean(activeVideoAssetId && failedVideoAssetId === activeVideoAssetId);
  const isPosterFadeOutActive = Boolean(
    activeVideoAssetId && isCurrentVideoRenderable && fadingPosterAssetId === activeVideoAssetId
  );
  const shouldConcealCloudflarePlayer = Boolean(
    activeVideoAssetId && !isCurrentVideoRenderable && !(isCurrentVideoFailed && !hasPosterFallback)
  );
  const shouldShowVideoPoster = Boolean(hasPosterFallback && (!isCurrentVideoRenderable || isPosterFadeOutActive));
  const isVideoHostVisible = Boolean(activeCloudflareVideoMediaItem && (isVideoExpanded || videoHostRect));
  const dateLabel = hasPersonalCard(card) ? dateFormatter.format(dateOnlyToUtcDate(card.targetDate)) : "";
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
  const updateVideoPlaybackIntent = useCallback((intent: VideoPlaybackIntent) => {
    videoPlaybackIntentRef.current = intent;
  }, []);
  const resetVideoDisplayState = useCallback(() => {
    setRenderableVideoAssetId(null);
    setFailedVideoAssetId(null);
    setFailedVideoPosterSrc(null);
    setFadingPosterAssetId(null);
  }, []);
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

    const nextStepViewState = {
      cardId: card.id,
      itemIndex: stepIndex + 1,
    };

    stepViewStateRef.current = nextStepViewState;
    updateVideoPlaybackIntent("idle");
    resetVideoDisplayState();
    setIsVideoExpanded(false);
    setStepViewState(nextStepViewState);
  };
  const openIntroView = () => {
    if (isFlipped) {
      return;
    }

    const nextStepViewState = {
      cardId: card.id,
      itemIndex: 0,
    };

    stepViewStateRef.current = nextStepViewState;
    updateVideoPlaybackIntent("idle");
    resetVideoDisplayState();
    setIsVideoExpanded(false);
    setStepViewState(nextStepViewState);
  };
  const closeStepView = () => {
    videoPlayerRef.current?.pauseAndReset();
    stepViewStateRef.current = null;
    activeVideoAssetIdRef.current = null;
    updateVideoPlaybackIntent("idle");
    setIsVideoExpanded(false);
    setVideoHostRect(null);
    setVideoAnchorElement(null);
    setStepViewState(null);
  };
  const goToStepViewItem = (direction: -1 | 1) => {
    const currentStepViewState = stepViewStateRef.current;

    if (!currentStepViewState || currentStepViewState.cardId !== card.id) {
      return;
    }

    const nextItemIndex = Math.max(
      0,
      Math.min(stepViewSequence.length - 1, currentStepViewState.itemIndex + direction)
    );

    if (nextItemIndex === currentStepViewState.itemIndex) {
      return;
    }

    const nextStepViewItem = stepViewSequence[nextItemIndex];
    const nextMediaItem = nextStepViewItem ? getStepViewMediaItem(card, nextStepViewItem) : null;
    const nextCloudflareVideoMediaItem =
      nextMediaItem && isCloudflareStreamVideoMediaItem(nextMediaItem) ? nextMediaItem : null;
    const shouldContinuePlayback = videoPlaybackIntentRef.current === "continue";
    const nextStepViewState = {
      ...currentStepViewState,
      itemIndex: nextItemIndex,
    };

    setIsVideoExpanded(false);

    if (nextCloudflareVideoMediaItem) {
      activeVideoAssetIdRef.current = nextCloudflareVideoMediaItem.assetId;
      resetVideoDisplayState();
      videoPlayerRef.current?.loadMedia(nextCloudflareVideoMediaItem, { shouldPlay: shouldContinuePlayback });
    } else {
      activeVideoAssetIdRef.current = null;
      videoPlayerRef.current?.pauseAndReset();
      resetVideoDisplayState();
      updateVideoPlaybackIntent("idle");
    }

    stepViewStateRef.current = nextStepViewState;
    setStepViewState(nextStepViewState);
  };
  const goToPreviousStepViewItem = () => {
    goToStepViewItem(-1);
  };
  const goToNextStepViewItem = () => {
    goToStepViewItem(1);
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
    allowedIntents: backFace ? ["settleToPast", "restoreFromPast", "flip"] : ["settleToPast", "restoreFromPast"],
    locked:
      isFocusedGestureLocked ||
      Boolean(stepViewItem) ||
      interactionLocked ||
      isVideoExpanded,
    onSettleToPast: settleFocusedCardToPast,
    onRestoreFromPast: restoreFocusedCardFromPast,
    onFlip: toggleFocusedCardSide,
  });

  useLayoutEffect(() => {
    stepViewStateRef.current = stepViewState;
    activeVideoAssetIdRef.current = activeVideoAssetId;
  }, [activeVideoAssetId, isDeckFlipped, stepViewState]);

  const [displayedAssetId, setDisplayedAssetId] = useState(activeVideoAssetId);
  if (displayedAssetId !== activeVideoAssetId) {
    setDisplayedAssetId(activeVideoAssetId);
    setRenderableVideoAssetId(null);
    setFailedVideoAssetId(null);
    setFailedVideoPosterSrc(null);
    setFadingPosterAssetId(null);
    if (!activeVideoAssetId) {
      setIsVideoExpanded(false);
      setExpandedLandscapeFrameSize(null);
      setVideoHostRect(null);
      setVideoAnchorElement(null);
    }
  }
  useEffect(() => {
    if (!activeCloudflareVideoMediaItem) {
      videoPlayerRef.current?.pauseAndReset();
      activeVideoAssetIdRef.current = null;
      updateVideoPlaybackIntent("idle");
    }
  }, [activeCloudflareVideoMediaItem, updateVideoPlaybackIntent]);
  useEffect(() => {
    if (!activeVideoAssetId || !hasPosterFallback || !isCurrentVideoRenderable) return;
    const fadeTimeout = window.setTimeout(() => {
      setFadingPosterAssetId((currentAssetId) => currentAssetId === activeVideoAssetId ? null : currentAssetId);
    }, 250);
    return () => window.clearTimeout(fadeTimeout);
  }, [activeVideoAssetId, hasPosterFallback, isCurrentVideoRenderable]);

  if ((!isVideoExpanded || isExpandedVideoPortrait) && expandedLandscapeFrameSize !== null) {
    setExpandedLandscapeFrameSize(null);
  }
  useLayoutEffect(() => {
    if (!isVideoExpanded || isExpandedVideoPortrait) return;

    const updateExpandedLandscapeFrameSize = () => {
      const hostElement = videoHostElementRef.current;

      if (!hostElement) {
        return;
      }

      const hostRect = hostElement.getBoundingClientRect();

      if (hostRect.width <= 1 || hostRect.height <= 1) {
        return;
      }

      const viewportSize = getViewportSize();
      const shouldFitLandscapeViewport =
        isExpandedVideoLandscape && viewportSize !== null && viewportSize.width > viewportSize.height;
      const nextWidth = Math.max(
        1,
        Math.round(shouldFitLandscapeViewport ? Math.min(hostRect.width, hostRect.height * (16 / 9)) : hostRect.width)
      );
      const nextHeight = Math.max(1, Math.round(Math.min(hostRect.height, nextWidth * (9 / 16))));

      setExpandedLandscapeFrameSize((currentSize) => {
        if (currentSize && currentSize.width === nextWidth && currentSize.height === nextHeight) {
          return currentSize;
        }

        return {
          width: nextWidth,
          height: nextHeight,
        };
      });
    };

    updateExpandedLandscapeFrameSize();

    const hostElement = videoHostElementRef.current;
    if (!hostElement) {
      return;
    }

    const resizeObserver = new ResizeObserver(updateExpandedLandscapeFrameSize);
    resizeObserver.observe(hostElement);
    window.addEventListener("resize", updateExpandedLandscapeFrameSize);
    window.visualViewport?.addEventListener("resize", updateExpandedLandscapeFrameSize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateExpandedLandscapeFrameSize);
      window.visualViewport?.removeEventListener("resize", updateExpandedLandscapeFrameSize);
    };
  }, [isExpandedVideoLandscape, isVideoExpanded, isExpandedVideoPortrait]);

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

  const [displayedContentIdentity, setDisplayedContentIdentity] = useState(contentIdentity);
  const [displayedDeckFlip, setDisplayedDeckFlip] = useState(isDeckFlipped);
  if (displayedContentIdentity !== contentIdentity) {
    setDisplayedContentIdentity(contentIdentity);
    setDisplayedDeckFlip(isDeckFlipped);
    setFlipState({ cardId: card.id, side: getDeckFlipSide(isDeckFlipped), rotationY: getDeckFlipRotation(isDeckFlipped) });
    setIsVideoExpanded(false);
    setExpandedLandscapeFrameSize(null);
    setRenderableVideoAssetId(null);
    setFailedVideoAssetId(null);
    setFailedVideoPosterSrc(null);
    setFadingPosterAssetId(null);
    setVideoHostRect(null);
    setVideoAnchorElement(null);
    setStepViewState(null);
  } else if (displayedDeckFlip !== isDeckFlipped) {
    setDisplayedDeckFlip(isDeckFlipped);
    const targetSide = getDeckFlipSide(isDeckFlipped);
    if (flipState.side !== targetSide) setFlipState({ ...flipState, side: targetSide,
      rotationY: flipState.rotationY + (targetSide === "back" ? 180 : -180) });
  }
  useEffect(() => {
    videoPlayerRef.current?.pauseAndReset();
    stepViewStateRef.current = null;
    activeVideoAssetIdRef.current = null;
    updateVideoPlaybackIntent("idle");
  }, [contentIdentity, updateVideoPlaybackIntent]);

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
          layoutId={`week-card-${cardPresentationIdentity(card)}`}
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
                  assessment={assessment}
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
              <CardCreatorAttribution card={card} />
              {!isFlipped ? frontAction : null}
            </div>
            {backFace ? <div className="physical-card focused-card-surface focused-card-surface--back" aria-hidden={!isFlipped} inert={!isFlipped}>
              <CardBackSlot content={backFace} onNext={settleFocusedCardToPast} onPrevious={restoreFocusedCardFromPast} />
            </div> : null}
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
      {isFlipped && onRequestAddComment ? (
        <div className="focused-shared-comment-actions">
          <button className="deck-shared-comment-button" onClick={onRequestAddComment} type="button">
            Add comment
          </button>
        </div>
      ) : null}
      {isVideoHostVisible && activeCloudflareVideoMediaItem ? (
        <div className="switchplay-video-host-layer" aria-hidden="true">
          {isVideoExpanded ? <div className="switchplay-video-expanded-backdrop" /> : null}
          <div
            ref={videoHostElementRef}
            className={`switchplay-video-host${
              isVideoExpanded ? " switchplay-video-host--expanded" : " switchplay-video-host--embedded"
            }${isExpandedVideoPortrait ? " switchplay-video-host--portrait" : " switchplay-video-host--landscape"}${
              isExpandedVideoLandscape ? " switchplay-video-host--known-landscape" : ""
            }`}
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
            <div
              ref={videoFrameElementRef}
              className="switchplay-video-frame"
              style={
                isVideoExpanded && !isExpandedVideoPortrait
                  ? expandedLandscapeFrameSize
                    ? {
                        height: `${expandedLandscapeFrameSize.height}px`,
                        width: `${expandedLandscapeFrameSize.width}px`,
                      }
                    : undefined
                  : undefined
              }
            >
              <div className="switchplay-video-content">
                {shouldShowVideoPoster ? (
                  <img
                    alt=""
                    aria-hidden="true"
                    key={activeVideoAssetId}
                    className={`switchplay-video-poster${isPosterFadeOutActive ? " switchplay-video-poster--fade-out" : ""}`}
                    onError={() => setFailedVideoPosterSrc(activeVideoPosterSrc)}
                    src={activeVideoPosterSrc ?? undefined}
                  />
                ) : null}
                <div className="switchplay-video-player-layer" style={shouldConcealCloudflarePlayer ? { visibility: "hidden" } : undefined}>
                  <CloudflareHlsVideoPlayer
                    ref={videoPlayerRef}
                    displayMode={isVideoExpanded ? "expanded" : "embedded"}
                    beforeLoad={videoGuard}
                    mediaItem={activeCloudflareVideoMediaItem}
                    onMediaDisplayStateChange={({ assetId, state }) => {
                      if (assetId !== activeVideoAssetIdRef.current) {
                        return;
                      }

                      if (state === "renderable") {
                        setRenderableVideoAssetId(assetId);
                        setFadingPosterAssetId(assetId);
                        setFailedVideoAssetId(null);
                        return;
                      }

                      setFailedVideoAssetId(assetId);
                    }}
                    onPlaybackIntentChange={updateVideoPlaybackIntent}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {overlays}
    </motion.div>
  );
}

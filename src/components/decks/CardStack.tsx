import { motion } from "motion/react";
import type { MotionStyle } from "motion/react";
import DeckCard from "@/components/decks/DeckCard";
import type { DeckGestureHandlers } from "@/components/decks/gestures/gestureTypes";
import type { WeeklyCard } from "@/components/decks/types";
import {
  ACTIVE_CARD_OCCLUSION_RELIEF,
  CARD_ASPECT_RATIO,
  CARD_OPACITY_STEP,
  CARD_SCALE_STEP,
  FUTURE_CONTINUATION_MAX_X_OFFSET,
  FUTURE_CONTINUATION_ROTATION_INITIAL_OFFSET,
  FUTURE_CONTINUATION_ROTATION_MIN_OFFSET,
  FUTURE_CONTINUATION_ROTATION_OFFSET_DECAY,
  FUTURE_CONTINUATION_X_INITIAL_OFFSET,
  FUTURE_CONTINUATION_X_MIN_OFFSET,
  FUTURE_CONTINUATION_X_OFFSET_DECAY,
  FUTURE_CONTINUATION_Y_INITIAL_OFFSET,
  FUTURE_CONTINUATION_Y_MIN_OFFSET,
  FUTURE_CONTINUATION_Y_OFFSET_DECAY,
  FUTURE_FIRST_REVEAL_OFFSET,
  FUTURE_FIRST_ROTATION_DEGREES,
  FUTURE_MAX_STACK_DEPTH,
  FUTURE_READABLE_COUNT,
  FUTURE_ROTATION_MAX_DEGREES,
  FUTURE_ROTATION_MAX_X_DRIFT,
  FUTURE_ROTATION_MAX_Y_LIFT,
  FUTURE_ROTATION_X_DRIFT,
  FUTURE_ROTATION_Y_LIFT,
  FUTURE_SECOND_REVEAL_OFFSET,
  FUTURE_SECOND_ROTATION_DEGREES,
  FUTURE_X_OFFSET,
  MIN_STACK_OPACITY,
  MAX_SCALE_REDUCTION,
  PAST_CARD_OPACITY_STEP,
  PAST_CARD_SCALE_STEP,
  PAST_TABLE_CARD_WIDTH,
  PAST_TABLE_MIN_X_OFFSET,
  PAST_TABLE_THIRD_X_OFFSET,
  PAST_TABLE_TRACE_INITIAL_X_OFFSET,
  PAST_TABLE_X_OFFSET,
  PAST_TABLE_X_OFFSET_DECAY,
  FUTURE_ZONE_HEIGHT,
  PROGRESSION_CARD_WIDTH,
  PROGRESSION_SCENE_HEIGHT,
  TABLE_ZONE_TOP,
} from "@/constants/cardStack";

type CardStackProps = {
  cards: WeeklyCard[];
  activeCardIndex: number;
  transitionPhase: CardTransitionPhase | null;
  onFocusCard: (cardIndex: number) => void;
  activeGestureHandlers?: DeckGestureHandlers;
  latestPastGestureHandlers?: DeckGestureHandlers;
  activeGesturePreviewY?: number;
  suppressActiveCardActivation?: boolean;
  transition: object;
};

type CardStackZone = "past" | "active" | "future";

export type CardTransitionPhase = {
  fromIndex: number;
  toIndex: number;
  direction: "next" | "previous";
};

type CardStackStyle = {
  zone: CardStackZone;
  showHeader: boolean;
  showProgress: boolean;
  style: MotionStyle & {
    "--past-depth"?: number;
    "--past-brightness"?: number;
    "--past-contrast"?: number;
    "--past-saturation"?: number;
    "--past-shadow-alpha"?: number;
    "--past-plane-shadow-x"?: number;
    "--past-plane-shadow-y"?: number;
    "--future-brightness"?: number;
    "--future-contrast"?: number;
    "--future-highlight-opacity"?: number;
    "--future-text-opacity"?: number;
    "--future-progress-opacity"?: number;
    "--future-saturation"?: number;
    "--future-softness"?: number;
  };
};

function getFutureDepth(relativeIndex: number) {
  if (relativeIndex === 1) {
    return FUTURE_FIRST_REVEAL_OFFSET;
  }

  if (relativeIndex === 2) {
    return FUTURE_SECOND_REVEAL_OFFSET;
  }

  const continuationRank = relativeIndex - 2;
  const compressedDepth = Array.from({ length: continuationRank }, (_, depth) =>
    Math.max(
      FUTURE_CONTINUATION_Y_MIN_OFFSET,
      FUTURE_CONTINUATION_Y_INITIAL_OFFSET * FUTURE_CONTINUATION_Y_OFFSET_DECAY ** depth
    )
  ).reduce((total, offset) => total + offset, 0);

  return Math.min(
    FUTURE_MAX_STACK_DEPTH,
    FUTURE_SECOND_REVEAL_OFFSET + compressedDepth
  );
}

function getFutureX(relativeIndex: number) {
  if (relativeIndex <= 2) {
    return relativeIndex * FUTURE_X_OFFSET;
  }

  const continuationRank = relativeIndex - 2;
  const continuationSpread = Array.from({ length: continuationRank }, (_, depth) =>
    Math.max(
      FUTURE_CONTINUATION_X_MIN_OFFSET,
      FUTURE_CONTINUATION_X_INITIAL_OFFSET * FUTURE_CONTINUATION_X_OFFSET_DECAY ** depth
    )
  ).reduce((total, offset) => total + offset, 0);

  return Math.min(
    FUTURE_CONTINUATION_MAX_X_OFFSET,
    2 * FUTURE_X_OFFSET + continuationSpread
  );
}

function getFutureRotation(relativeIndex: number) {
  if (relativeIndex === 1) {
    return FUTURE_FIRST_ROTATION_DEGREES;
  }

  if (relativeIndex === 2) {
    return FUTURE_SECOND_ROTATION_DEGREES;
  }

  const continuationRank = relativeIndex - 2;
  const compressedRotation = Array.from({ length: continuationRank }, (_, depth) =>
    Math.max(
      FUTURE_CONTINUATION_ROTATION_MIN_OFFSET,
      FUTURE_CONTINUATION_ROTATION_INITIAL_OFFSET * FUTURE_CONTINUATION_ROTATION_OFFSET_DECAY ** depth
    )
  ).reduce((total, offset) => total + offset, 0);

  return Math.min(
    FUTURE_ROTATION_MAX_DEGREES,
    FUTURE_SECOND_ROTATION_DEGREES + compressedRotation
  );
}

function getFutureRotationXDrift(relativeIndex: number) {
  return Math.min(FUTURE_ROTATION_MAX_X_DRIFT, relativeIndex * FUTURE_ROTATION_X_DRIFT);
}

function getFutureRotationYLift(relativeIndex: number) {
  return Math.min(FUTURE_ROTATION_MAX_Y_LIFT, relativeIndex * FUTURE_ROTATION_Y_LIFT);
}

function getScale(depthIndex: number, scaleStep: number) {
  return 1 - Math.min(depthIndex * scaleStep, MAX_SCALE_REDUCTION);
}

function getOpacity(depthIndex: number, opacityStep: number) {
  return Math.max(1 - depthIndex * opacityStep, MIN_STACK_OPACITY);
}

function getPastTableGap(newerPastRank: number) {
  if (newerPastRank === 1) {
    return PAST_TABLE_X_OFFSET;
  }

  if (newerPastRank === 2) {
    return PAST_TABLE_THIRD_X_OFFSET;
  }

  return Math.max(
    PAST_TABLE_MIN_X_OFFSET,
    PAST_TABLE_TRACE_INITIAL_X_OFFSET * PAST_TABLE_X_OFFSET_DECAY ** (newerPastRank - 3)
  );
}

function getPastTableX(index: number, activeCardIndex: number) {
  if (activeCardIndex <= 2) {
    return index * PAST_TABLE_X_OFFSET;
  }

  return Array.from({ length: index }, (_, gapIndex) => {
    const newerCardIndex = gapIndex + 1;
    const newerPastRank = activeCardIndex - newerCardIndex;

    return getPastTableGap(newerPastRank);
  }).reduce((total, gap) => total + gap, 0);
}

function getCardStackStyle(index: number, activeCardIndex: number, totalCards: number): CardStackStyle {
  const relativeIndex = index - activeCardIndex;
  const activeTop = FUTURE_ZONE_HEIGHT;

  if (relativeIndex === 0) {
    return {
      zone: "active",
      showHeader: true,
      showProgress: true,
      style: {
        top: activeTop,
        right: 0,
        left: 0,
        width: PROGRESSION_CARD_WIDTH,
        aspectRatio: CARD_ASPECT_RATIO,
        marginInline: "auto",
        x: 0,
        y: ACTIVE_CARD_OCCLUSION_RELIEF,
        scale: 1,
        opacity: 1,
        zIndex: totalCards * 3,
      },
    };
  }

  if (relativeIndex > 0) {
    const futureDepth = getFutureDepth(relativeIndex);
    const futureAtmosphericDepth = relativeIndex;
    const futureRotation = getFutureRotation(relativeIndex);

    return {
      zone: "future",
      showHeader: relativeIndex <= FUTURE_READABLE_COUNT,
      showProgress: relativeIndex <= FUTURE_READABLE_COUNT,
      style: {
        top: activeTop,
        right: 0,
        left: 0,
        width: PROGRESSION_CARD_WIDTH,
        aspectRatio: CARD_ASPECT_RATIO,
        marginInline: "auto",
        x: getFutureX(relativeIndex) + getFutureRotationXDrift(relativeIndex),
        y: -futureDepth - getFutureRotationYLift(relativeIndex),
        rotate: futureRotation,
        transformOrigin: "100% 0%",
        scale: getScale(relativeIndex, CARD_SCALE_STEP),
        opacity: getOpacity(relativeIndex, CARD_OPACITY_STEP),
        "--future-brightness": Math.max(0.74, 0.9 - futureAtmosphericDepth * 0.04),
        "--future-contrast": Math.max(0.78, 0.94 - futureAtmosphericDepth * 0.055),
        "--future-highlight-opacity": Math.max(0.42, 0.82 - futureAtmosphericDepth * 0.11),
        "--future-progress-opacity": Math.max(0.78, 1 - futureAtmosphericDepth * 0.035),
        "--future-saturation": Math.max(0.74, 0.98 - futureAtmosphericDepth * 0.055),
        "--future-softness": Math.min(0.26, futureAtmosphericDepth * 0.035),
        "--future-text-opacity": Math.max(0.56, 0.9 - futureAtmosphericDepth * 0.105),
        zIndex: totalCards * 2 - relativeIndex,
      },
    };
  }

  const pastIndex = Math.abs(relativeIndex);
  const pastDepthForTone = Math.min(pastIndex, 6);

  return {
    zone: "past",
    showHeader: true,
    showProgress: true,
    style: {
      top: TABLE_ZONE_TOP,
      right: "auto",
      left: 0,
      width: PAST_TABLE_CARD_WIDTH,
      aspectRatio: CARD_ASPECT_RATIO,
      x: getPastTableX(index, activeCardIndex),
      y: 0,
      scale: getScale(pastIndex, PAST_CARD_SCALE_STEP),
      rotate: 0,
      transformOrigin: "50% 50%",
      opacity: getOpacity(pastIndex, PAST_CARD_OPACITY_STEP),
      "--past-depth": pastIndex,
      "--past-brightness": Math.max(0.72, 0.9 - pastDepthForTone * 0.035),
      "--past-contrast": Math.max(0.86, 0.96 - pastDepthForTone * 0.018),
      "--past-saturation": Math.max(0.72, 0.98 - pastDepthForTone * 0.035),
      "--past-shadow-alpha": Math.max(0.16, 0.3 - pastDepthForTone * 0.025),
      "--past-plane-shadow-x": Math.max(-2.4, -0.35 - pastDepthForTone * 0.22),
      "--past-plane-shadow-y": Math.min(12, 6 + pastDepthForTone * 0.65),
      zIndex: totalCards + index,
    },
  };
}

export default function CardStack({
  cards,
  activeCardIndex,
  transitionPhase,
  onFocusCard,
  activeGestureHandlers,
  latestPastGestureHandlers,
  activeGesturePreviewY = 0,
  suppressActiveCardActivation = false,
  transition,
}: CardStackProps) {
  const displayedActiveCardIndex = transitionPhase?.fromIndex ?? activeCardIndex;

  return (
    <motion.div
      className="card-stack card-progression-scene"
      style={{ height: PROGRESSION_SCENE_HEIGHT }}
      layout
    >
      <div className="table-surface" aria-hidden="true" />
      <div className="active-contact-atmosphere" aria-hidden="true" />
      {cards
        .map((card, index) => {
          const baseStackStyle = getCardStackStyle(index, displayedActiveCardIndex, cards.length);
          const isActiveInteractionCard = !transitionPhase && index === activeCardIndex;
          const isLatestPastInteractionCard = !transitionPhase && index === activeCardIndex - 1;
          const outgoingTargetStyle =
            transitionPhase && index === transitionPhase.fromIndex
              ? getCardStackStyle(index, transitionPhase.toIndex, cards.length)
              : null;
          const positionStackStyle = outgoingTargetStyle ?? baseStackStyle;

          return (
            <DeckCard
              key={card.id}
              card={card}
              stackZone={baseStackStyle.zone}
              showHeader={baseStackStyle.showHeader}
              showProgress={baseStackStyle.showProgress}
              onActivate={isActiveInteractionCard ? () => onFocusCard(index) : undefined}
              gestureHandlers={
                isActiveInteractionCard
                  ? activeGestureHandlers
                  : isLatestPastInteractionCard
                    ? latestPastGestureHandlers
                    : undefined
              }
              suppressActivation={isActiveInteractionCard ? suppressActiveCardActivation : false}
              style={{
                ...positionStackStyle.style,
                y:
                  isActiveInteractionCard && typeof positionStackStyle.style.y === "number"
                    ? positionStackStyle.style.y + activeGesturePreviewY
                    : positionStackStyle.style.y,
                // During a phase, the stack stays anchored to fromIndex while
                // only that outgoing card receives the target geometry. This
                // prevents the incoming card occupying the active slot early.
                zIndex: baseStackStyle.style.zIndex,
              }}
              transition={transition}
            />
          );
        })}
    </motion.div>
  );
}

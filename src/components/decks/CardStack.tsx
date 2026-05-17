import { motion } from "motion/react";
import type { MotionStyle } from "motion/react";
import DeckCard from "@/components/decks/DeckCard";
import type { WeeklyCard } from "@/components/decks/types";
import {
  CARD_ASPECT_RATIO,
  CARD_OPACITY_STEP,
  CARD_SCALE_STEP,
  FUTURE_DEEP_INITIAL_OFFSET,
  FUTURE_DEEP_MIN_OFFSET,
  FUTURE_DEEP_OFFSET_DECAY,
  FUTURE_DEEP_MAX_X_OFFSET,
  FUTURE_DEEP_X_INITIAL_OFFSET,
  FUTURE_DEEP_X_MIN_OFFSET,
  FUTURE_DEEP_X_OFFSET_DECAY,
  FUTURE_HEADER_OFFSET,
  FUTURE_MAX_STACK_DEPTH,
  FUTURE_READABLE_COUNT,
  FUTURE_X_OFFSET,
  MIN_STACK_OPACITY,
  MAX_SCALE_REDUCTION,
  PAST_CARD_OPACITY_STEP,
  PAST_CARD_SCALE_STEP,
  PAST_TABLE_CARD_WIDTH,
  PAST_TABLE_ARCHIVE_DECAY,
  PAST_TABLE_ARCHIVE_INITIAL_X_OFFSET,
  PAST_TABLE_ARCHIVE_MIN_X_OFFSET,
  PAST_TABLE_MAX_X_OFFSET,
  PAST_TABLE_READABLE_COUNT,
  PAST_TABLE_X_OFFSET,
  PAST_TABLE_Y_OFFSET,
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
  if (relativeIndex <= FUTURE_READABLE_COUNT) {
    return relativeIndex * FUTURE_HEADER_OFFSET;
  }

  const deepFutureRank = relativeIndex - FUTURE_READABLE_COUNT;
  const compressedDepth = Array.from({ length: deepFutureRank }, (_, depth) =>
    Math.max(
      FUTURE_DEEP_MIN_OFFSET,
      FUTURE_DEEP_INITIAL_OFFSET * FUTURE_DEEP_OFFSET_DECAY ** depth
    )
  ).reduce((total, offset) => total + offset, 0);

  return Math.min(
    FUTURE_MAX_STACK_DEPTH,
    FUTURE_READABLE_COUNT * FUTURE_HEADER_OFFSET + compressedDepth
  );
}

function getFutureX(relativeIndex: number) {
  if (relativeIndex <= FUTURE_READABLE_COUNT) {
    return relativeIndex * FUTURE_X_OFFSET;
  }

  const deepFutureRank = relativeIndex - FUTURE_READABLE_COUNT;
  const deepSpread = Array.from({ length: deepFutureRank }, (_, depth) =>
    Math.max(
      FUTURE_DEEP_X_MIN_OFFSET,
      FUTURE_DEEP_X_INITIAL_OFFSET * FUTURE_DEEP_X_OFFSET_DECAY ** depth
    )
  ).reduce((total, offset) => total + offset, 0);

  return Math.min(
    FUTURE_DEEP_MAX_X_OFFSET,
    FUTURE_READABLE_COUNT * FUTURE_X_OFFSET + deepSpread
  );
}

function getScale(depthIndex: number, scaleStep: number) {
  return 1 - Math.min(depthIndex * scaleStep, MAX_SCALE_REDUCTION);
}

function getOpacity(depthIndex: number, opacityStep: number) {
  return Math.max(1 - depthIndex * opacityStep, MIN_STACK_OPACITY);
}

function getPastTableX(index: number, activeCardIndex: number) {
  const pastRank = activeCardIndex - index;
  const newestPastX = Math.min((activeCardIndex - 1) * PAST_TABLE_X_OFFSET, PAST_TABLE_MAX_X_OFFSET);

  if (pastRank <= PAST_TABLE_READABLE_COUNT) {
    return Math.max(0, newestPastX - (pastRank - 1) * PAST_TABLE_X_OFFSET);
  }

  const readableEdgeX = Math.max(0, newestPastX - (PAST_TABLE_READABLE_COUNT - 1) * PAST_TABLE_X_OFFSET);
  const archiveRank = pastRank - PAST_TABLE_READABLE_COUNT;
  const archiveCompression = Array.from({ length: archiveRank }, (_, depth) =>
    Math.max(
      PAST_TABLE_ARCHIVE_MIN_X_OFFSET,
      PAST_TABLE_ARCHIVE_INITIAL_X_OFFSET * PAST_TABLE_ARCHIVE_DECAY ** depth
    )
  ).reduce((total, offset) => total + offset, 0);

  return Math.max(0, readableEdgeX - archiveCompression);
}

function getCardStackStyle(index: number, activeCardIndex: number, totalCards: number): CardStackStyle {
  const relativeIndex = index - activeCardIndex;
  const activeTop = FUTURE_ZONE_HEIGHT;
  const isMostRecentPast = relativeIndex === -1;

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
        y: 0,
        scale: 1,
        opacity: 1,
        zIndex: totalCards * 3,
      },
    };
  }

  if (relativeIndex > 0) {
    const futureDepth = getFutureDepth(relativeIndex);
    const futureAtmosphericDepth = relativeIndex;

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
        x: getFutureX(relativeIndex),
        y: -futureDepth,
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
      y: (activeCardIndex - index - 1) * PAST_TABLE_Y_OFFSET,
      scale: getScale(pastIndex, PAST_CARD_SCALE_STEP),
      rotate: Math.max(-0.72, -0.14 - pastDepthForTone * 0.08),
      transformOrigin: "14% 88%",
      opacity: getOpacity(pastIndex, PAST_CARD_OPACITY_STEP),
      "--past-depth": pastIndex,
      "--past-brightness": Math.max(0.72, 0.9 - pastDepthForTone * 0.035),
      "--past-saturation": Math.max(0.72, 0.98 - pastDepthForTone * 0.035),
      "--past-shadow-alpha": Math.max(0.16, 0.3 - pastDepthForTone * 0.025),
      "--past-plane-shadow-x": Math.max(-2.4, -0.35 - pastDepthForTone * 0.22),
      "--past-plane-shadow-y": Math.min(12, 6 + pastDepthForTone * 0.65),
      // Keep the just-completed card above the incoming active card during
      // layout projection so the same visible card travels into the table.
      zIndex: isMostRecentPast ? totalCards * 3 + 1 : totalCards + index,
    },
  };
}

export default function CardStack({ cards, activeCardIndex, transitionPhase, onFocusCard, transition }: CardStackProps) {
  const displayedActiveCardIndex = transitionPhase?.fromIndex ?? activeCardIndex;

  return (
    <motion.div
      className="card-stack card-progression-scene"
      style={{ height: PROGRESSION_SCENE_HEIGHT }}
      layout
    >
      <div className="table-surface" aria-hidden="true" />
      {cards
        .map((card, index) => {
          const baseStackStyle = getCardStackStyle(index, displayedActiveCardIndex, cards.length);
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
              onActivate={!transitionPhase && index === activeCardIndex ? () => onFocusCard(index) : undefined}
              style={{
                ...positionStackStyle.style,
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

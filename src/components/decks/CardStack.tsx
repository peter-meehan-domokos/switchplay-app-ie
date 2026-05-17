import { motion } from "motion/react";
import type { MotionStyle } from "motion/react";
import DeckCard from "@/components/decks/DeckCard";
import type { WeeklyCard } from "@/components/decks/types";
import {
  CARD_ASPECT_RATIO,
  CARD_OPACITY_STEP,
  CARD_SCALE_STEP,
  FUTURE_COMPRESSED_OFFSET,
  FUTURE_HEADER_OFFSET,
  FUTURE_X_OFFSET,
  MIN_STACK_OPACITY,
  MAX_SCALE_REDUCTION,
  PAST_CARD_OPACITY_STEP,
  PAST_CARD_SCALE_STEP,
  PAST_TABLE_CARD_WIDTH,
  PAST_TABLE_COMPRESSED_MAX_X_OFFSET,
  PAST_TABLE_COMPRESSED_X_OFFSET,
  PAST_TABLE_COMPRESSION_THRESHOLD,
  PAST_TABLE_MAX_X_OFFSET,
  PAST_TABLE_X_OFFSET,
  PAST_TABLE_Y_OFFSET,
  FUTURE_ZONE_HEIGHT,
  PROGRESSION_CARD_WIDTH,
  PROGRESSION_SCENE_HEIGHT,
  TABLE_ZONE_TOP,
  VISIBLE_CONTEXT_CARDS,
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
  style: MotionStyle & { "--past-depth"?: number };
};

function getFutureDepth(relativeIndex: number) {
  if (relativeIndex <= VISIBLE_CONTEXT_CARDS) {
    return relativeIndex * FUTURE_HEADER_OFFSET;
  }

  return VISIBLE_CONTEXT_CARDS * FUTURE_HEADER_OFFSET + (relativeIndex - VISIBLE_CONTEXT_CARDS) * FUTURE_COMPRESSED_OFFSET;
}

function getScale(depthIndex: number, scaleStep: number) {
  return 1 - Math.min(depthIndex * scaleStep, MAX_SCALE_REDUCTION);
}

function getOpacity(depthIndex: number, opacityStep: number) {
  return Math.max(1 - depthIndex * opacityStep, MIN_STACK_OPACITY);
}

function getPastTableX(index: number, activeCardIndex: number) {
  const shouldCompressHistory = activeCardIndex >= PAST_TABLE_COMPRESSION_THRESHOLD;
  const offset = shouldCompressHistory ? PAST_TABLE_COMPRESSED_X_OFFSET : PAST_TABLE_X_OFFSET;
  const maxOffset = shouldCompressHistory ? PAST_TABLE_COMPRESSED_MAX_X_OFFSET : PAST_TABLE_MAX_X_OFFSET;

  return Math.min(index * offset, maxOffset);
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

    return {
      zone: "future",
      showHeader: relativeIndex <= VISIBLE_CONTEXT_CARDS,
      showProgress: relativeIndex <= VISIBLE_CONTEXT_CARDS,
      style: {
        top: activeTop,
        right: 0,
        left: 0,
        width: PROGRESSION_CARD_WIDTH,
        aspectRatio: CARD_ASPECT_RATIO,
        marginInline: "auto",
        x: Math.min(relativeIndex, VISIBLE_CONTEXT_CARDS + 1) * FUTURE_X_OFFSET,
        y: -futureDepth,
        scale: getScale(relativeIndex, CARD_SCALE_STEP),
        opacity: getOpacity(relativeIndex, CARD_OPACITY_STEP),
        zIndex: totalCards * 2 - relativeIndex,
      },
    };
  }

  const pastIndex = Math.abs(relativeIndex);

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
      opacity: getOpacity(pastIndex, PAST_CARD_OPACITY_STEP),
      "--past-depth": pastIndex,
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

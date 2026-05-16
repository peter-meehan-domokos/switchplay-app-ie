import { motion } from "motion/react";
import DeckCard from "@/components/decks/DeckCard";
import type { WeeklyCard } from "@/components/decks/types";
import {
  ACTIVE_CARD_INDEX,
  COMPRESSED_CARD_UPWARD_OFFSET,
  CONTEXT_CARD_UPWARD_OFFSET,
  CONTEXT_OPACITY_STEP,
  CONTEXT_SCALE_STEP,
  MAX_SCALE_REDUCTION,
  MIN_STACK_OPACITY,
  STACK_CARD_HEIGHT,
  STACK_SIDE_STEP,
  VISIBLE_CONTEXT_CARDS,
} from "@/constants/cardStack";

type CardStackProps = {
  cards: WeeklyCard[];
  transition: object;
};

function getCardDepth(index: number) {
  const relativeIndex = index - ACTIVE_CARD_INDEX;

  if (relativeIndex <= 0) {
    return 0;
  }

  if (relativeIndex <= VISIBLE_CONTEXT_CARDS) {
    return relativeIndex * CONTEXT_CARD_UPWARD_OFFSET;
  }

  return (
    VISIBLE_CONTEXT_CARDS * CONTEXT_CARD_UPWARD_OFFSET +
    (relativeIndex - VISIBLE_CONTEXT_CARDS) * COMPRESSED_CARD_UPWARD_OFFSET
  );
}

function getCardScale(relativeIndex: number) {
  return 1 - Math.min(relativeIndex * CONTEXT_SCALE_STEP, MAX_SCALE_REDUCTION);
}

function getCardOpacity(relativeIndex: number) {
  return Math.max(1 - relativeIndex * CONTEXT_OPACITY_STEP, MIN_STACK_OPACITY);
}

export default function CardStack({ cards, transition }: CardStackProps) {
  const stackDepth =
    VISIBLE_CONTEXT_CARDS * CONTEXT_CARD_UPWARD_OFFSET +
    Math.max(cards.length - VISIBLE_CONTEXT_CARDS - 1, 0) * COMPRESSED_CARD_UPWARD_OFFSET;

  return (
    <motion.div className="card-stack" style={{ height: `calc(${STACK_CARD_HEIGHT} + ${stackDepth}px)` }} layout>
      {cards
        .map((card, index) => ({ card, index, depth: getCardDepth(index) }))
        .reverse()
        .map(({ card, index, depth }) => {
          const relativeIndex = index - ACTIVE_CARD_INDEX;
          const isActive = relativeIndex === 0;
          const isReadableContext = relativeIndex > 0 && relativeIndex <= VISIBLE_CONTEXT_CARDS;
          const showHeader = relativeIndex >= 0 && relativeIndex <= VISIBLE_CONTEXT_CARDS;

          return (
            <DeckCard
              key={card.id}
              card={card}
              isActive={isActive}
              isReadableContext={isReadableContext}
              showHeader={showHeader}
              style={{
                x: isActive ? 0 : Math.min(relativeIndex, VISIBLE_CONTEXT_CARDS + 1) * STACK_SIDE_STEP,
                y: -depth,
                scale: isActive ? 1 : getCardScale(relativeIndex),
                opacity: isActive ? 1 : getCardOpacity(relativeIndex),
                zIndex: cards.length - index,
              }}
              transition={transition}
            />
          );
        })}
    </motion.div>
  );
}

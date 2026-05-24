import { motion, type MotionStyle } from "motion/react";
import ActiveCardFront from "@/components/cards/ActiveCardFront";
import CardSemanticAnchors from "@/components/decks/CardSemanticAnchors";
import type { DeckGestureHandlers } from "@/components/decks/gestures/gestureTypes";
import type { WeeklyCard } from "@/components/decks/types";

type DeckCardProps = {
  card: WeeklyCard;
  stackZone: "past" | "active" | "future";
  showHeader: boolean;
  showProgress: boolean;
  onActivate?: () => void;
  gestureHandlers?: DeckGestureHandlers;
  suppressActivation?: boolean;
  style: MotionStyle;
  transition: object;
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
});

export default function DeckCard({
  card,
  stackZone,
  showHeader,
  showProgress,
  onActivate,
  gestureHandlers,
  suppressActivation = false,
  style,
  transition,
}: DeckCardProps) {
  const cardStateClass = showHeader || showProgress ? `is-${stackZone}` : `is-${stackZone} is-compressed`;
  const handleActivate = () => {
    if (!suppressActivation) {
      onActivate?.();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (!onActivate) {
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleActivate();
    }
  };

  return (
    <motion.article
      className={`physical-card deck-card ${cardStateClass}`}
      layout
      layoutId={`week-card-${card.id}`}
      role={onActivate ? "button" : undefined}
      tabIndex={onActivate ? 0 : undefined}
      onClick={onActivate ? handleActivate : undefined}
      onKeyDown={handleKeyDown}
      style={style}
      transition={transition}
      {...gestureHandlers}
    >
      <div className="deck-card-content">
        {stackZone === "active" || stackZone === "past" ? (
          <ActiveCardFront card={card} dateLabel={dateFormatter.format(new Date(card.targetDate))} />
        ) : showHeader || showProgress ? (
          <CardSemanticAnchors
            card={card}
            dateLabel={dateFormatter.format(new Date(card.targetDate))}
            showText={showHeader}
          />
        ) : null}
      </div>
    </motion.article>
  );
}

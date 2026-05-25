import { motion, type MotionStyle } from "motion/react";
import ActiveCardFront from "@/components/cards/ActiveCardFront";
import type { CardLayout } from "@/components/cards/cardLayout";
import BackCardFaceContent from "@/components/decks/BackCardFaceContent";
import CardSemanticAnchors from "@/components/decks/CardSemanticAnchors";
import type { DeckGestureHandlers } from "@/components/decks/gestures/gestureTypes";

type DeckCardProps = {
  card: CardLayout;
  isDeckFlipped: boolean;
  deckFlipRotationY: number;
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

const deckFlipTransition = {
  duration: 0.68,
  ease: [0.22, 0.72, 0.18, 1],
} as const;

export default function DeckCard({
  card,
  isDeckFlipped,
  deckFlipRotationY,
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
  const dateLabel = dateFormatter.format(new Date(card.targetDate));
  const backFaceVariant = stackZone === "past" ? "preview" : "deck";
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
      className={`deck-card-slot deck-card ${cardStateClass}`}
      data-deck-flipped={isDeckFlipped ? "true" : "false"}
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
      <motion.div
        className="physical-card deck-card-object"
        initial={{ rotateY: deckFlipRotationY }}
        animate={{ rotateY: deckFlipRotationY }}
        transition={deckFlipTransition}
      >
        <div className="deck-card-surface deck-card-surface--front" aria-hidden={isDeckFlipped}>
          <div className="deck-card-content">
            {stackZone === "active" || stackZone === "past" ? (
              <ActiveCardFront card={card} dateLabel={dateLabel} />
            ) : showHeader || showProgress ? (
              <CardSemanticAnchors card={card} dateLabel={dateLabel} showText={showHeader} />
            ) : null}
          </div>
        </div>
        <div className="deck-card-surface deck-card-surface--back" aria-hidden={!isDeckFlipped}>
          {showHeader || showProgress ? <BackCardFaceContent card={card} dateLabel={dateLabel} variant={backFaceVariant} /> : null}
        </div>
      </motion.div>
    </motion.article>
  );
}

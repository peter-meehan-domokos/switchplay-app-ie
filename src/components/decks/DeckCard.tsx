import type { OpenCardMedia } from "@/lib/cardMediaViewer";
import { motion, type MotionStyle } from "motion/react";
import { useState } from "react";
import CardCreatorAttribution from "@/components/cards/CardCreatorAttribution";
import ActiveCardFront from "@/components/cards/ActiveCardFront";
import { cardPresentationIdentity, hasPersonalCard, type PresentedCard, type CardBackPresentation } from "./presentation";
import CardSemanticAnchors from "@/components/decks/CardSemanticAnchors";
import type { DeckGestureHandlers } from "@/components/decks/gestures/gestureTypes";
import { dateOnlyToUtcDate } from "@/lib/dateOnly";

type DeckCardProps = {
  onOpenMedia?: OpenCardMedia;
  assessment?: import("react").ReactNode;
  frontAction?: import("react").ReactNode;
  renderBackFace?: CardBackPresentation;
  card: PresentedCard;
  deckTemplateId: string;
  isDeckFlipped: boolean;
  deckFlipRotationY: number;
  stackZone: "past" | "active" | "future";
  showHeader: boolean;
  showProgress: boolean;
  prepareContent?: boolean;
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
  onOpenMedia,
  assessment,
  frontAction,
  renderBackFace,
  card,
  isDeckFlipped,
  deckFlipRotationY,
  stackZone,
  showHeader,
  showProgress,
  prepareContent = false,
  onActivate,
  gestureHandlers,
  suppressActivation = false,
  style,
  transition,
}: DeckCardProps) {
  const cardStateClass = showHeader || showProgress ? `is-${stackZone}` : `is-${stackZone} is-compressed`;
  const personal = hasPersonalCard(card);
  const dateLabel = personal ? dateFormatter.format(dateOnlyToUtcDate(card.targetDate)) : "";
  // Incoming content mounts in the same commit that starts movement. Keep it
  // afterwards so reversing navigation never swaps a complete face for anchors.
  const needsContent = prepareContent || stackZone !== "future";
  const [hasContent, setHasContent] = useState(needsContent);
  if (needsContent && !hasContent) setHasContent(true);
  const { x, y, scale, rotate, opacity, ...placementStyle } = style;
  const handleActivate = () => {
    if (!suppressActivation) {
      onActivate?.();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return;
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
      layoutId={`week-card-${cardPresentationIdentity(card)}`}
      role={onActivate ? isDeckFlipped && onOpenMedia ? "group" : "button" : undefined}
      aria-label={isDeckFlipped && onOpenMedia ? `${card.label}. Press Enter to focus this card, or open a media item.` : undefined}
      tabIndex={onActivate ? 0 : undefined}
      onClick={onActivate ? handleActivate : undefined}
      onKeyDown={handleKeyDown}
      initial={false}
      style={placementStyle}
      animate={{
        x: typeof x === "number" ? x : 0,
        y: typeof y === "number" ? y : 0,
        scale: typeof scale === "number" ? scale : 1,
        rotate: typeof rotate === "number" ? rotate : 0,
        opacity: typeof opacity === "number" ? opacity : 1,
      }}
      transition={transition}
      {...gestureHandlers}
    >
      <motion.div
        className="physical-card deck-card-object"
        initial={{ rotateY: deckFlipRotationY }}
        animate={{ rotateY: deckFlipRotationY }}
        transition={deckFlipTransition}
      >
        <div className="deck-card-render-surface">
          <div className="deck-card-surface deck-card-surface--front" aria-hidden={isDeckFlipped} inert={isDeckFlipped}>
            <div className="deck-card-content">
              {hasContent ? (
                <ActiveCardFront assessment={assessment} card={card} dateLabel={dateLabel} />
              ) : showHeader || showProgress ? (
                <CardSemanticAnchors assessment={assessment} card={card} dateLabel={dateLabel} showText={showHeader} />
              ) : null}
            </div>
            <CardCreatorAttribution card={card} />
            {frontAction}
          </div>
          {renderBackFace ? <div className="deck-card-surface deck-card-surface--back" aria-hidden={!isDeckFlipped} inert={!isDeckFlipped}>
            {showHeader || showProgress ? renderBackFace(card, { dateLabel, variant: "deck", onOpenMedia: isDeckFlipped ? onOpenMedia : undefined }) : null}
          </div> : null}
        </div>
      </motion.div>
    </motion.article>
  );
}

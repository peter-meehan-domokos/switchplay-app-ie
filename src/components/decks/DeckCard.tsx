import { motion, type MotionStyle } from "motion/react";
import CardSemanticAnchors from "@/components/decks/CardSemanticAnchors";
import type { WeeklyCard } from "@/components/decks/types";

type DeckCardProps = {
  card: WeeklyCard;
  stackZone: "past" | "active" | "future";
  showHeader: boolean;
  showProgress: boolean;
  onActivate?: () => void;
  style: MotionStyle;
  transition: object;
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
});

export default function DeckCard({ card, stackZone, showHeader, showProgress, onActivate, style, transition }: DeckCardProps) {
  const cardStateClass = showHeader || showProgress ? `is-${stackZone}` : `is-${stackZone} is-compressed`;
  const previewItems = card.items.slice(0, 2);
  const primaryStat = card.stats[0];

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (!onActivate) {
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onActivate();
    }
  };

  return (
    <motion.article
      className={`physical-card deck-card ${cardStateClass}`}
      layout
      layoutId={`week-card-${card.id}`}
      role={onActivate ? "button" : undefined}
      tabIndex={onActivate ? 0 : undefined}
      onClick={onActivate}
      onKeyDown={handleKeyDown}
      style={style}
      transition={transition}
    >
      <div className="deck-card-content">
        {showHeader || showProgress ? (
          <CardSemanticAnchors
            card={card}
            dateLabel={dateFormatter.format(new Date(card.targetDate))}
            showText={showHeader}
          />
        ) : null}
        {stackZone === "active" ? (
          <div className="deck-card-preview">
            <p className="deck-card-subtitle">{card.subtitle}</p>
            <div className="preview-list">
              {previewItems.map((item) => (
                <p key={item.id}>{item.description}</p>
              ))}
            </div>
            {primaryStat ? (
              <p className="preview-kpi">
                {primaryStat.title}: {primaryStat.targetValue}
                {primaryStat.unit}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </motion.article>
  );
}

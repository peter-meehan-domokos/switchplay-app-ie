import { motion, type MotionStyle } from "motion/react";
import type { WeeklyCard } from "@/components/decks/types";

type DeckCardProps = {
  card: WeeklyCard;
  isActive: boolean;
  isReadableContext: boolean;
  showHeader: boolean;
  style: MotionStyle;
  transition: object;
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
});

export default function DeckCard({ card, isActive, isReadableContext, showHeader, style, transition }: DeckCardProps) {
  const cardStateClass = isActive ? "is-active" : isReadableContext ? "is-readable-context" : "is-compressed";

  return (
    <motion.article
      className={`deck-card ${cardStateClass}`}
      layout
      style={style}
      transition={transition}
    >
      <div className="deck-card-content">
        {showHeader ? (
          <header className="deck-card-header">
            <p className="deck-card-date">{dateFormatter.format(new Date(card.targetDate))}</p>
            <h2>{card.title}</h2>
          </header>
        ) : null}
        {isActive ? <p className="deck-card-subtitle">{card.subtitle}</p> : null}
      </div>
    </motion.article>
  );
}

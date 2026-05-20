import type { WeeklyCardItem, WeeklyCard } from "@/components/decks/types";
import { getCardProgressPercentage } from "@/lib/progress";

type CardSemanticAnchorsProps = {
  card: WeeklyCard;
  dateLabel: string;
  showText?: boolean;
  showProgress?: boolean;
  variant?: "front" | "back";
};

export default function CardSemanticAnchors({
  card,
  dateLabel,
  showText = true,
  showProgress = true,
  variant = "front",
}: CardSemanticAnchorsProps) {
  const progressPercentage = showProgress
    ? getCardProgressPercentage(
        card.items.map((item): Pick<WeeklyCardItem, "completionStatus"> => ({
          completionStatus: item.completionStatus,
        }))
      )
    : null;

  return (
    <header className={`card-semantic-anchors card-semantic-anchors--${variant}`}>
      <div className="card-title-anchor">
        {showText ? <h2>{card.title}</h2> : null}
        {showProgress ? (
          <div className="completion-strip" aria-label="Progress preview">
            <span className="completion-strip-fill" style={{ width: `${progressPercentage}%` }} />
          </div>
        ) : null}
      </div>
      {showText ? <p className="deck-card-date">{dateLabel}</p> : null}
    </header>
  );
}

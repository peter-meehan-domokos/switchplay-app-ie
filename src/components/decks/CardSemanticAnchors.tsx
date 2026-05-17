import type { WeeklyCard } from "@/components/decks/types";
import { getCardProgressPercentage } from "@/lib/progress";

type CardSemanticAnchorsProps = {
  card: WeeklyCard;
  dateLabel: string;
  showText?: boolean;
};

export default function CardSemanticAnchors({ card, dateLabel, showText = true }: CardSemanticAnchorsProps) {
  const progressItems: Array<{ completionStatus: "todo" | "inProgress" | "done" }> = card.items.map((item) => ({
    completionStatus:
      item.completionStatus === "done" || item.completionStatus === "inProgress" ? item.completionStatus : "todo",
  }));
  const progressPercentage = getCardProgressPercentage(progressItems);

  return (
    <header className="card-semantic-anchors">
      <div className="card-title-anchor">
        {showText ? <h2>{card.title}</h2> : null}
        <div className="completion-strip" aria-label="Progress preview">
          <span className="completion-strip-fill" style={{ width: `${progressPercentage}%` }} />
        </div>
      </div>
      {showText ? <p className="deck-card-date">{dateLabel}</p> : null}
    </header>
  );
}

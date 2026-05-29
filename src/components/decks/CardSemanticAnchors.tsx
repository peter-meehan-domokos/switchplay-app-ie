import type { CardLayout } from "@/components/cards/cardLayout";

type CardSemanticAnchorsProps = {
  card: CardLayout;
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
  const progressPercentage = showProgress ? card.progressPercentage : null;

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

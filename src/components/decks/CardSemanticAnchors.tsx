import type { SyntheticEvent } from "react";
import type { CardLayout } from "@/components/cards/cardLayout";

type CardSemanticAnchorsProps = {
  card: CardLayout;
  dateLabel: string;
  showText?: boolean;
  showProgress?: boolean;
  variant?: "front" | "back" | "focused";
  onAdjustTargetDate?: (direction: -1 | 1) => void;
};

export default function CardSemanticAnchors({
  card,
  dateLabel,
  showText = true,
  showProgress = true,
  variant = "front",
  onAdjustTargetDate,
}: CardSemanticAnchorsProps) {
  const progressPercentage = showProgress ? card.progressPercentage : null;
  const surfaceVariant = variant === "back" ? "back" : "front";
  const isTargetDateInteractive = variant === "focused" && typeof onAdjustTargetDate === "function";

  const stopInteractionPropagation = (event: SyntheticEvent) => {
    event.stopPropagation();
  };

  const handleTargetDateShift = (direction: -1 | 1) => {
    onAdjustTargetDate?.(direction);
  };

  return (
    <header className={`card-semantic-anchors card-semantic-anchors--${surfaceVariant}`}>
      <div className="card-title-anchor">
        {showText ? <h2>{card.title}</h2> : null}
        {showProgress ? (
          <div className="completion-strip" aria-label="Progress preview">
            <span className="completion-strip-fill" style={{ width: `${progressPercentage}%` }} />
          </div>
        ) : null}
      </div>
      {showText ? (
        <div className="deck-card-date-shell">
          <p className="deck-card-date">{dateLabel}</p>
          {isTargetDateInteractive ? (
            <>
              <button
                type="button"
                className="deck-card-date-hit-zone deck-card-date-hit-zone--left"
                aria-label="Move target date one day earlier"
                onPointerDown={stopInteractionPropagation}
                onClick={(event) => {
                  stopInteractionPropagation(event);
                  handleTargetDateShift(-1);
                }}
              />
              <button
                type="button"
                className="deck-card-date-hit-zone deck-card-date-hit-zone--right"
                aria-label="Move target date one day later"
                onPointerDown={stopInteractionPropagation}
                onClick={(event) => {
                  stopInteractionPropagation(event);
                  handleTargetDateShift(1);
                }}
              />
            </>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}

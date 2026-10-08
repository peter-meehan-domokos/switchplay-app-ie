import type { SyntheticEvent } from "react";
import { hasPersonalCard, type PresentedCard } from "./presentation";

type CardSemanticAnchorsProps = {
  card: PresentedCard;
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
  const personal = hasPersonalCard(card);
  const progressPercentage = showProgress && personal ? card.progressPercentage : null;
  const surfaceVariant = variant === "back" ? "back" : "front";
  const isTargetDateInteractive = personal && variant === "focused" && typeof onAdjustTargetDate === "function";

  const stopInteractionPropagation = (event: SyntheticEvent) => {
    event.stopPropagation();
  };

  const handleTargetDateShift = (direction: -1 | 1) => {
    onAdjustTargetDate?.(direction);
  };

  return (
    <header className={`card-semantic-anchors card-semantic-anchors--${surfaceVariant}`}>
      <div className="card-title-anchor">
        {showText ? <h2>{card.label}</h2> : null}
        {showProgress && personal ? (
          <div className="completion-strip" aria-label="Progress preview">
            <span className="completion-strip-fill" style={{ width: `${progressPercentage}%` }} />
          </div>
        ) : showProgress ? <div className="completion-strip personal-layout-slot" aria-hidden="true" /> : null}
      </div>
      {showText ? (
        <div className={`deck-card-date-shell${personal ? "" : " personal-date-slot"}`} aria-hidden={personal ? undefined : true}>
          <p className="deck-card-date">{personal ? dateLabel : ""}</p>
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

import VisibilityIndicator from "@/components/media/VisibilityIndicator";
import { progressObservationState } from "@/lib/frameworks/progressState";
import { getConfidenceScore } from "@/lib/signals";
import type { SyntheticEvent } from "react";
import { hasPersonalCard, isExperienceCard, type PresentedCard } from "./presentation";
import ConfidencePair from "@/components/group-experiences/ConfidencePair";
import { dateOnlyToUtcDate } from "@/lib/dateOnly";

type CardSemanticAnchorsProps = {
  assessment?: import("react").ReactNode;
  card: PresentedCard;
  dateLabel: string;
  showText?: boolean;
  showProgress?: boolean;
  variant?: "front" | "back" | "focused";
  onAdjustTargetDate?: (direction: -1 | 1) => void;
};

export default function CardSemanticAnchors({
  assessment,
  card,
  dateLabel,
  showText = true,
  showProgress = true,
  variant = "front",
  onAdjustTargetDate,
}: CardSemanticAnchorsProps) {
  const personal = hasPersonalCard(card);
  const experience = isExperienceCard(card);
  const confidence = personal ? getConfidenceScore(card.signals.map((signal) => signal.rawReading)) : experience ? card.confidence : null;
  const progressPercentage = showProgress ? personal ? card.progressPercentage : experience ? card.completion : null : null;
  const skipped = (personal || experience) && progressObservationState(card.steps).state === "skipped";
  const hasDate = personal || experience && card.ownerDate != null;
  const shownDate = experience && card.ownerDate ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(dateOnlyToUtcDate(card.ownerDate)) : dateLabel;
  const surfaceVariant = variant === "back" ? "back" : "front";
  const isTargetDateInteractive = personal && variant === "focused" && typeof onAdjustTargetDate === "function";

  const stopInteractionPropagation = (event: SyntheticEvent) => {
    event.stopPropagation();
  };

  const handleTargetDateShift = (direction: -1 | 1) => {
    onAdjustTargetDate?.(direction);
  };

  return (
    <header className={`card-semantic-anchors card-semantic-anchors--${surfaceVariant}${assessment ? " card-semantic-anchors--assessment" : ""}`}>
      <div className="card-title-anchor">
        {showText ? <><h2>{card.label}</h2>{assessment ? <div className="card-assessment-anchor">{assessment}</div> : null}</> : null}
        {showProgress && (progressPercentage !== null || skipped) ? (
          <div className={`completion-strip${skipped ? " completion-strip--skipped" : ""}`} aria-label={skipped ? "All Steps skipped" : "Progress preview"}>
            <span className="completion-strip-fill" style={{ width: `${skipped ? 100 : progressPercentage}%` }} />
          </div>
        ) : showProgress ? <div className="completion-strip personal-layout-slot" aria-hidden="true" /> : null}
      </div>
      {showText && (personal || experience) ? <span className="card-confidence">
        {experience && card.aggregates ? <ConfidencePair groupCard group={confidence} follower={card.aggregates.followers.confidence} activeTotal={card.aggregates.followers.activeTotal} />
          : <span aria-label={confidence === null ? "Confidence not set" : `Confidence ${confidence} out of 10`}>{confidence}</span>}
      </span> : null}
      {showText ? (
        <div className={`deck-card-date-shell${hasDate ? "" : " personal-date-slot"}`} aria-hidden={hasDate ? undefined : true}>
          <p className="deck-card-date">{hasDate ? shownDate : ""}{experience && card.ownerDate ? <span className="date-visibility-indicator"> <VisibilityIndicator visible={false} /></span> : null}</p>
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

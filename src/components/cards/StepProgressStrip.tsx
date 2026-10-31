import type { MouseEvent, ReactNode } from "react";
import type { CompletionStatus } from "@/components/decks/types";

type StepProgressStripProps = {
  completionStatus: CompletionStatus;
  onCycleStatus?: () => void;
  layout?: "default" | "experience";
  adornment?: ReactNode;
};

const progressByStatus: Record<StepProgressStripProps["completionStatus"], number> = {
  done: 100,
  inProgress: 52,
  skipped: 100,
  todo: 0,
};

export default function StepProgressStrip({ completionStatus, onCycleStatus, layout = "default", adornment }: StepProgressStripProps) {
  const strip = (
    <span
      className={`step-progress-strip step-progress-strip--${completionStatus}${layout === "experience" ? " step-progress-strip--experience" : ""}`}
      aria-hidden={onCycleStatus ? true : undefined}
      aria-label={onCycleStatus ? undefined : `Step progress: ${completionStatus}`}
    >
      <span
        className={`step-progress-strip-fill step-progress-strip-fill--${completionStatus}`}
        style={{ width: `${progressByStatus[completionStatus]}%` }}
      />
    </span>
  );

  function handleCycleStatus(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    onCycleStatus?.();
  }

  const control = onCycleStatus ? (
    <button
      type="button"
      className="step-progress-hit-area"
      onClick={handleCycleStatus}
      aria-label={`Update step progress. Current status: ${completionStatus}`}
    >
      {layout === "default" ? strip : null}
    </button>
  ) : null;
  if (layout === "experience") {
    // Reproduce main's visual slot independently of edit authority. Counts are
    // an annotation on the 3px bar, not a second flow item that resizes Steps.
    // The real button remains separate so tapping counts cannot edit progress.
    return <span className="step-progress-experience">{control}
      <span className="step-progress-experience-anchor">{strip}{adornment}</span>
    </span>;
  }
  return onCycleStatus ? control : strip;
}

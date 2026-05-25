import type { CompletionStatus } from "@/components/decks/types";

type StepProgressStripProps = {
  completionStatus: CompletionStatus;
  onCycleStatus?: () => void;
};

const progressByStatus: Record<StepProgressStripProps["completionStatus"], number> = {
  done: 100,
  inProgress: 52,
  skipped: 100,
  todo: 0,
};

export default function StepProgressStrip({ completionStatus, onCycleStatus }: StepProgressStripProps) {
  const strip = (
    <span
      className={`step-progress-strip step-progress-strip--${completionStatus}`}
      aria-hidden={onCycleStatus ? true : undefined}
      aria-label={onCycleStatus ? undefined : `Step progress: ${completionStatus}`}
    >
      <span
        className={`step-progress-strip-fill step-progress-strip-fill--${completionStatus}`}
        style={{ width: `${progressByStatus[completionStatus]}%` }}
      />
    </span>
  );

  if (!onCycleStatus) {
    return strip;
  }

  return (
    <button
      type="button"
      className="step-progress-hit-area"
      onClick={onCycleStatus}
      aria-label={`Update step progress. Current status: ${completionStatus}`}
    >
      {strip}
    </button>
  );
}

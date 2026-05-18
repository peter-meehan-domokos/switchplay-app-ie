type StepProgressStripProps = {
  completionStatus: "todo" | "inProgress" | "done";
};

const progressByStatus: Record<StepProgressStripProps["completionStatus"], number> = {
  done: 100,
  inProgress: 52,
  todo: 0,
};

export default function StepProgressStrip({ completionStatus }: StepProgressStripProps) {
  return (
    <span className="step-progress-strip" aria-label={`Step progress: ${completionStatus}`}>
      <span
        className="step-progress-strip-fill"
        style={{ width: `${progressByStatus[completionStatus]}%` }}
      />
    </span>
  );
}

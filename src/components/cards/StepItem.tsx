import type { WeeklyCard } from "@/components/decks/types";
import StepProgressStrip from "@/components/cards/StepProgressStrip";

type StepItemProps = {
  item: WeeklyCard["items"][number];
};

export default function StepItem({ item }: StepItemProps) {
  const completionStatus =
    item.completionStatus === "done" || item.completionStatus === "inProgress"
      ? item.completionStatus
      : "todo";

  return (
    <li className="active-step-item">
      <span className="step-play-icon" aria-hidden="true" />
      <span className="step-copy">
        <span className="step-description">{item.description}</span>
        <StepProgressStrip completionStatus={completionStatus} />
      </span>
    </li>
  );
}

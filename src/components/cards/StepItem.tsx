import type { WeeklyCardItem } from "@/components/decks/types";
import StepProgressStrip from "@/components/cards/StepProgressStrip";
import { normalizeCompletionStatus } from "@/lib/progress";

type StepItemProps = {
  item: WeeklyCardItem;
  onCycleStatus?: (itemId: string) => void;
};

export default function StepItem({ item, onCycleStatus }: StepItemProps) {
  const completionStatus = normalizeCompletionStatus(item.completionStatus);

  return (
    <li className="active-step-item">
      <span className="step-play-icon" aria-hidden="true" />
      <span className="step-copy">
        <span className="step-description">{item.description}</span>
        <StepProgressStrip
          completionStatus={completionStatus}
          onCycleStatus={onCycleStatus ? () => onCycleStatus(item.id) : undefined}
        />
      </span>
    </li>
  );
}

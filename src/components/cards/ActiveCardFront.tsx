import type { CardLayout } from "@/components/cards/cardLayout";
import CardHeader from "@/components/cards/CardHeader";
import IntroMediaBlock from "@/components/cards/IntroMediaBlock";
import StepList from "@/components/cards/StepList";

type ActiveCardFrontProps = {
  card: CardLayout;
  dateLabel: string;
  variant?: "active" | "focused";
  onCycleStepStatus?: (stepId: string) => void;
  onAdjustTargetDate?: (direction: -1 | 1) => void;
  onStepNavigateNext?: () => void;
  onStepNavigatePrevious?: () => void;
};

export default function ActiveCardFront({
  card,
  dateLabel,
  variant = "active",
  onCycleStepStatus,
  onAdjustTargetDate,
  onStepNavigateNext,
  onStepNavigatePrevious,
}: ActiveCardFrontProps) {
  return (
    <div className={`active-card-front active-card-front--${variant}`}>
      <CardHeader card={card} dateLabel={dateLabel} variant={variant} onAdjustTargetDate={onAdjustTargetDate} />
      <IntroMediaBlock card={card} />
      <StepList
        steps={card.steps}
        onCycleStepStatus={variant === "focused" ? onCycleStepStatus : undefined}
        onStepNavigateNext={variant === "focused" ? onStepNavigateNext : undefined}
        onStepNavigatePrevious={variant === "focused" ? onStepNavigatePrevious : undefined}
      />
    </div>
  );
}

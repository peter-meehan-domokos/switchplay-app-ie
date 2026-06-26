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
  onOpenIntroView?: () => void;
  onOpenStepView?: (stepIndex: number) => void;
  onStepNavigateNext?: () => void;
  onStepNavigatePrevious?: () => void;
};

export default function ActiveCardFront({
  card,
  dateLabel,
  variant = "active",
  onCycleStepStatus,
  onAdjustTargetDate,
  onOpenIntroView,
  onOpenStepView,
  onStepNavigateNext,
  onStepNavigatePrevious,
}: ActiveCardFrontProps) {
  return (
    <div className={`active-card-front active-card-front--${variant}`}>
      <CardHeader card={card} dateLabel={dateLabel} variant={variant} onAdjustTargetDate={onAdjustTargetDate} />
      <IntroMediaBlock
        card={card}
        onOpenIntroView={variant === "focused" ? onOpenIntroView : undefined}
        onIntroNavigateNext={variant === "focused" ? onStepNavigateNext : undefined}
        onIntroNavigatePrevious={variant === "focused" ? onStepNavigatePrevious : undefined}
      />
      <StepList
        steps={card.steps}
        onCycleStepStatus={variant === "focused" ? onCycleStepStatus : undefined}
        onOpenStepView={variant === "focused" ? onOpenStepView : undefined}
        onStepNavigateNext={variant === "focused" ? onStepNavigateNext : undefined}
        onStepNavigatePrevious={variant === "focused" ? onStepNavigatePrevious : undefined}
      />
    </div>
  );
}

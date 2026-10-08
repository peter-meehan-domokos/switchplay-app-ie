import { hasPersonalCard, type PresentedCard } from "@/components/decks/presentation";
import CardHeader from "@/components/cards/CardHeader";
import IntroMediaBlock from "@/components/cards/IntroMediaBlock";
import StepList from "@/components/cards/StepList";

//ActiveCardFront component displays the front view of an active card, including the header, intro media block, and step list.
type ActiveCardFrontProps = {
  card: PresentedCard;
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
        showPersonalProgress={hasPersonalCard(card)}
        linksEnabled={variant === "focused"}
        onCycleStepStatus={variant === "focused" && hasPersonalCard(card) ? onCycleStepStatus : undefined}
        onOpenStepView={variant === "focused" ? onOpenStepView : undefined}
        onStepNavigateNext={variant === "focused" ? onStepNavigateNext : undefined}
        onStepNavigatePrevious={variant === "focused" ? onStepNavigatePrevious : undefined}
      />
    </div>
  );
}

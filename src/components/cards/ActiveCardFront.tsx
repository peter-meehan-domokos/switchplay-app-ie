import { hasPersonalCard, type PresentedCard } from "@/components/decks/presentation";
import CardHeader from "@/components/cards/CardHeader";
import IntroMediaBlock from "@/components/cards/IntroMediaBlock";
import StepList from "@/components/cards/StepList";

//ActiveCardFront component displays the front view of an active card, including the header, intro media block, and step list.
type ActiveCardFrontProps = {
  assessment?: import("react").ReactNode;
  staticSelection?: boolean;
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
  assessment,
  staticSelection = false,
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
  const interactive = variant === "focused" && !staticSelection;
  return (
    <div className={`active-card-front active-card-front--${variant}`}>
      <CardHeader assessment={staticSelection ? undefined : assessment} card={card} dateLabel={dateLabel}
        variant={staticSelection ? "active" : variant} onAdjustTargetDate={staticSelection ? undefined : onAdjustTargetDate} />
      <IntroMediaBlock
        card={card}
        onOpenIntroView={interactive ? onOpenIntroView : undefined}
        onIntroNavigateNext={interactive ? onStepNavigateNext : undefined}
        onIntroNavigatePrevious={interactive ? onStepNavigatePrevious : undefined}
      />
      {staticSelection && card.intro.description ? <p className="card-selection-description">{card.intro.description}</p> : null}
      <StepList
        steps={card.steps}
        showPersonalProgress={!staticSelection && hasPersonalCard(card)}
        linksEnabled={interactive}
        onCycleStepStatus={interactive && hasPersonalCard(card) ? onCycleStepStatus : undefined}
        onOpenStepView={interactive ? onOpenStepView : undefined}
        onStepNavigateNext={interactive ? onStepNavigateNext : undefined}
        onStepNavigatePrevious={interactive ? onStepNavigatePrevious : undefined}
      />
    </div>
  );
}

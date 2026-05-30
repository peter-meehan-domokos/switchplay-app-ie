import type { CardLayout } from "@/components/cards/cardLayout";
import CardHeader from "@/components/cards/CardHeader";
import IntroMediaBlock from "@/components/cards/IntroMediaBlock";
import StepList from "@/components/cards/StepList";

type ActiveCardFrontProps = {
  card: CardLayout;
  dateLabel: string;
  variant?: "active" | "focused";
  onCycleItemStatus?: (itemId: string) => void;
  onAdjustTargetDate?: (direction: -1 | 1) => void;
};

export default function ActiveCardFront({
  card,
  dateLabel,
  variant = "active",
  onCycleItemStatus,
  onAdjustTargetDate,
}: ActiveCardFrontProps) {
  return (
    <div className={`active-card-front active-card-front--${variant}`}>
      <CardHeader card={card} dateLabel={dateLabel} variant={variant} onAdjustTargetDate={onAdjustTargetDate} />
      <IntroMediaBlock card={card} />
      <StepList items={card.items} onCycleItemStatus={variant === "focused" ? onCycleItemStatus : undefined} />
    </div>
  );
}

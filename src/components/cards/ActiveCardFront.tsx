import CardHeader from "@/components/cards/CardHeader";
import IntroMediaBlock from "@/components/cards/IntroMediaBlock";
import StepList from "@/components/cards/StepList";
import type { WeeklyCard } from "@/components/decks/types";

type ActiveCardFrontProps = {
  card: WeeklyCard;
  dateLabel: string;
  variant?: "active" | "focused";
};

export default function ActiveCardFront({ card, dateLabel, variant = "active" }: ActiveCardFrontProps) {
  return (
    <div className={`active-card-front active-card-front--${variant}`}>
      <CardHeader card={card} dateLabel={dateLabel} />
      <IntroMediaBlock card={card} />
      <StepList items={card.items} />
    </div>
  );
}

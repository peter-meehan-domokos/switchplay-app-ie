import CardSemanticAnchors from "@/components/decks/CardSemanticAnchors";
import type { WeeklyCard } from "@/components/decks/types";

type CardHeaderProps = {
  card: WeeklyCard;
  dateLabel: string;
};

export default function CardHeader({ card, dateLabel }: CardHeaderProps) {
  return <CardSemanticAnchors card={card} dateLabel={dateLabel} />;
}

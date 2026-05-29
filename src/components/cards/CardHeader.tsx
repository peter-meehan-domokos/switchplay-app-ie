import type { CardLayout } from "@/components/cards/cardLayout";
import CardSemanticAnchors from "@/components/decks/CardSemanticAnchors";

type CardHeaderProps = {
  card: CardLayout;
  dateLabel: string;
};

export default function CardHeader({ card, dateLabel }: CardHeaderProps) {
  return <CardSemanticAnchors card={card} dateLabel={dateLabel} />;
}

import type { CardLayout } from "@/components/cards/cardLayout";
import CardSemanticAnchors from "@/components/decks/CardSemanticAnchors";

type CardHeaderProps = {
  card: CardLayout;
  dateLabel: string;
  variant?: "active" | "focused";
  onAdjustTargetDate?: (direction: -1 | 1) => void;
};

export default function CardHeader({ card, dateLabel, variant, onAdjustTargetDate }: CardHeaderProps) {
  const semanticVariant = variant === "focused" ? "focused" : "front";

  return <CardSemanticAnchors card={card} dateLabel={dateLabel} variant={semanticVariant} onAdjustTargetDate={onAdjustTargetDate} />;
}

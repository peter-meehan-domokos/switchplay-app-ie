import type { PresentedCard } from "@/components/decks/presentation";
import CardSemanticAnchors from "@/components/decks/CardSemanticAnchors";

type CardHeaderProps = {
  card: PresentedCard;
  dateLabel: string;
  variant?: "active" | "focused";
  onAdjustTargetDate?: (direction: -1 | 1) => void;
};

export default function CardHeader({ card, dateLabel, variant, onAdjustTargetDate }: CardHeaderProps) {
  const semanticVariant = variant === "focused" ? "focused" : "front";

  return <CardSemanticAnchors card={card} dateLabel={dateLabel} variant={semanticVariant} onAdjustTargetDate={onAdjustTargetDate} />;
}

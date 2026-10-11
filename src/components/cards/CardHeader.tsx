import type { PresentedCard } from "@/components/decks/presentation";
import CardSemanticAnchors from "@/components/decks/CardSemanticAnchors";

type CardHeaderProps = {
  assessment?: import("react").ReactNode;
  card: PresentedCard;
  dateLabel: string;
  variant?: "active" | "focused";
  onAdjustTargetDate?: (direction: -1 | 1) => void;
};

export default function CardHeader({ assessment, card, dateLabel, variant, onAdjustTargetDate }: CardHeaderProps) {
  const semanticVariant = variant === "focused" ? "focused" : "front";

  return <CardSemanticAnchors assessment={assessment} card={card} dateLabel={dateLabel} variant={semanticVariant} onAdjustTargetDate={onAdjustTargetDate} />;
}

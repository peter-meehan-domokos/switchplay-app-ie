import StepItem from "@/components/cards/StepItem";
import type { WeeklyCard } from "@/components/decks/types";

type StepListProps = {
  items: WeeklyCard["items"];
  onCycleItemStatus?: (itemId: string) => void;
};

export default function StepList({ items, onCycleItemStatus }: StepListProps) {
  return (
    <ol className="active-step-list">
      {items.map((item, index) => (
        <StepItem key={item.id} index={index} item={item} onCycleStatus={onCycleItemStatus} />
      ))}
    </ol>
  );
}

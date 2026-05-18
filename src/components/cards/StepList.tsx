import StepItem from "@/components/cards/StepItem";
import type { WeeklyCard } from "@/components/decks/types";

type StepListProps = {
  items: WeeklyCard["items"];
};

export default function StepList({ items }: StepListProps) {
  return (
    <ol className="active-step-list">
      {items.map((item) => (
        <StepItem key={item.id} item={item} />
      ))}
    </ol>
  );
}

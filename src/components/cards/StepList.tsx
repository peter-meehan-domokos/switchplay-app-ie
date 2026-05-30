import StepItem from "@/components/cards/StepItem";
import type { PointerEvent } from "react";
import type { WeeklyCard } from "@/components/decks/types";

type StepListProps = {
  items: WeeklyCard["items"];
  onCycleItemStatus?: (itemId: string) => void;
};

const isContentGestureShieldDebug = process.env.NODE_ENV === "development";

function blockContentGesturePropagation(event: PointerEvent<HTMLOListElement>) {
  event.stopPropagation();

  if (isContentGestureShieldDebug && event.type === "pointerdown") {
    console.debug("Step block captured gesture", {
      pointerType: event.pointerType,
    });
  }
}

export default function StepList({ items, onCycleItemStatus }: StepListProps) {
  return (
    <ol
      className="active-step-list"
      onPointerDown={blockContentGesturePropagation}
      onPointerMove={blockContentGesturePropagation}
      onPointerUp={blockContentGesturePropagation}
      onPointerCancel={blockContentGesturePropagation}
    >
      {items.map((item, index) => (
        <StepItem key={item.id} index={index} item={item} onCycleStatus={onCycleItemStatus} />
      ))}
    </ol>
  );
}

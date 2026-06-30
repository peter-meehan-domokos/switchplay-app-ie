import type { CSSProperties, KeyboardEvent, MouseEvent, PointerEvent } from "react";

type BackCardReflectionFragmentProps = {
  ariaLabel?: string;
  isEditable?: boolean;
  onClick?: () => void;
  reflectionVerticalOffset?: number;
  showPlaceholder?: boolean;
  text?: string | null;
};

type ReflectionFragmentStyle = CSSProperties & {
  "--reflection-y-offset"?: string;
};

const reflectionPlaceholderText = "Add a reflection...";

export default function BackCardReflectionFragment({
  ariaLabel,
  isEditable = false,
  onClick,
  reflectionVerticalOffset = 0,
  showPlaceholder = false,
  text,
}: BackCardReflectionFragmentProps) {
  const hasText = typeof text === "string" && text.trim().length > 0;
  const canEdit = isEditable && Boolean(onClick);

  if (!hasText && !showPlaceholder) {
    return null;
  }

  const stopReflectionGesturePropagation = (event: PointerEvent<HTMLParagraphElement>) => {
    if (!canEdit) {
      return;
    }

    event.stopPropagation();
  };

  const handleReflectionClick = (event: MouseEvent<HTMLParagraphElement>) => {
    if (!canEdit) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    onClick?.();
  };

  const handleReflectionKeyDown = (event: KeyboardEvent<HTMLParagraphElement>) => {
    if (!canEdit) {
      return;
    }

    event.stopPropagation();

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick?.();
    }
  };

  const style: ReflectionFragmentStyle = {
    "--reflection-y-offset": `${reflectionVerticalOffset}px`,
  };
  const className = [
    "focused-card-back-reflection-fragment",
    hasText ? undefined : "focused-card-back-reflection-fragment--placeholder",
    canEdit ? "focused-card-back-reflection-fragment--editable" : undefined,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <p
      aria-label={canEdit ? ariaLabel : undefined}
      className={className}
      onClick={handleReflectionClick}
      onKeyDown={handleReflectionKeyDown}
      onPointerCancel={stopReflectionGesturePropagation}
      onPointerDown={stopReflectionGesturePropagation}
      onPointerMove={stopReflectionGesturePropagation}
      onPointerUp={stopReflectionGesturePropagation}
      role={canEdit ? "button" : undefined}
      style={style}
      tabIndex={canEdit ? 0 : undefined}
    >
      {hasText ? text : reflectionPlaceholderText}
    </p>
  );
}

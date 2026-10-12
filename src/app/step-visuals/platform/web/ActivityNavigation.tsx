import { useEffect, useId, useRef, useState } from "react";
import type { PresentationAction } from "../../activities/roots-factors/presentationLayouts";
import styles from "./LearningUI.module.css";

/** Navigation presentation only; the action keeps its existing reducer identity. */
type NavigationProps = { action: PresentationAction | null; onAction?: (id: string) => void; sizing?: boolean };

/** Ephemeral web feedback only: unavailable activation never dispatches a lesson action. */
function NavigationControl({ action, onAction, sizing }: { action: PresentationAction; onAction?: NavigationProps["onAction"]; sizing: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const hintId = useId();
  const canExplain = !sizing && !!onAction && !action.enabled && !!action.unavailableReason;
  const showHint = open && canExplain;
  useEffect(() => {
    if (!showHint) return;
    const outside = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside, true); document.removeEventListener("keydown", escape); };
  }, [showHint]);
  return <div className={styles.spvNavigationControl} ref={ref}>
    <button className={styles.spvNavigationAction} type="button" disabled={!onAction || (!action.enabled && !canExplain)} aria-disabled={!action.enabled || undefined}
      aria-describedby={showHint ? hintId : undefined} onBlur={() => setOpen(false)} onClick={() => {
        if (action.enabled) onAction?.(action.id);
        else if (canExplain) setOpen(true);
      }}>
      {action.label}{action.directionCue !== false ? <span aria-hidden="true">→</span> : null}
    </button>
    {showHint ? <span className={styles.spvNavigationHint} role="tooltip" id={hintId}>{action.unavailableReason}</span> : null}
    {!sizing && onAction && action.id === "ready" ? <span className={styles.spvStatus} role="status" aria-live="polite" aria-atomic="true">{showHint ? action.unavailableReason : ""}</span> : null}
  </div>;
}

export default function ActivityNavigation({ action, onAction, sizing = false }: NavigationProps) {
  return <div className={styles.spvNavigation} data-spv-navigation={sizing ? undefined : true}>
    {action ? <NavigationControl key={action.id} action={action} onAction={onAction} sizing={sizing} /> : null}
  </div>;
}

"use client";
import { useEffect, useId, useRef, useState, type PointerEvent, type SyntheticEvent } from "react";
import { DECK_GESTURE_THRESHOLDS } from "@/components/decks/gestures/gestureThresholds";
import AssessmentModal from "./AssessmentModal";
import AssessmentSymbols from "./AssessmentSymbols";
import { useAssessmentHistory, type AssessmentContext } from "./useAssessmentHistory";

export default function AssessmentControl({ context, onOpenChange, variant = "front" }: { context: AssessmentContext; onOpenChange?: (open: boolean) => void; variant?: "front" | "back" }) {
  const descriptionId = useId();
  const history = useAssessmentHistory(context);
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null), restoreFocus = useRef(false);
  const pointerStart = useRef<{ id: number; x: number; y: number } | null>(null), dragged = useRef(false);
  useEffect(() => { if (!open && restoreFocus.current) { trigger.current?.focus(); restoreFocus.current = false; } }, [open]);
  const changeOpen = (value: boolean) => { if (value) restoreFocus.current = true; setOpen(value); onOpenChange?.(value); };
  const results = !history.loading && !history.error && history.data?.history.state !== "incomplete" ? history.data?.history.latestThree ?? [] : [];
  const label = history.loading ? "Loading assessment history" : history.error ? "Assessment history unavailable"
    : history.data?.history.state === "incomplete" ? "Assessment history incomplete" : results.length ? "Open assessment history" : "Add first test";
  const stop = (event: SyntheticEvent) => event.stopPropagation();
  const trackPointer = (event: PointerEvent<HTMLButtonElement>) => {
    const start = pointerStart.current;
    if (start?.id === event.pointerId && Math.hypot(event.clientX - start.x, event.clientY - start.y) >= DECK_GESTURE_THRESHOLDS.deadZonePx) dragged.current = true;
  };
  return <>
    <button ref={trigger} type="button" className="assessment-indicator" data-card-header-control aria-label={label} aria-describedby={results.length ? descriptionId : undefined} aria-haspopup="dialog"
      onPointerDown={(event) => { if (event.button !== 0) return; dragged.current = false; pointerStart.current = { id: event.pointerId, x: event.clientX, y: event.clientY }; event.currentTarget.setPointerCapture(event.pointerId); }}
      onPointerMove={trackPointer} onPointerUp={(event) => { trackPointer(event); pointerStart.current = null; }}
      onPointerCancel={() => { dragged.current = true; pointerStart.current = null; }} onKeyDown={stop}
      onClick={(event) => { stop(event); if (event.detail === 0 || !dragged.current) changeOpen(true); }}>
      <AssessmentSymbols results={results} showTestLabel={variant === "back"}
        status={history.loading ? "loading" : history.error ? "unavailable" : history.data?.history.state === "incomplete" ? "incomplete" : undefined} />
    </button>
    <span id={descriptionId} hidden>{results.map((result) => `${result.date}: ${result.result ? "Pass" : "Fail"}`).join(", ")}</span>
    {open ? <AssessmentModal context={context} history={history} onClose={() => changeOpen(false)} /> : null}
  </>;
}

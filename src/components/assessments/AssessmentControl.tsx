"use client";
import { useEffect, useId, useRef, useState, type PointerEvent, type SyntheticEvent } from "react";
import { DECK_GESTURE_THRESHOLDS } from "@/components/decks/gestures/gestureThresholds";
import AssessmentModal from "./AssessmentModal";
import { useAssessmentHistory, type AssessmentContext } from "./useAssessmentHistory";

export default function AssessmentControl({ context, onOpenChange, interactive = true }: { context: AssessmentContext; onOpenChange?: (open: boolean) => void; variant?: "front" | "back"; interactive?: boolean }) {
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
    <button ref={trigger} type="button" className="assessment-indicator" disabled={!interactive} style={!interactive ? { pointerEvents: "none" } : undefined} data-card-header-control aria-label={label} aria-describedby={results.length ? descriptionId : undefined} aria-haspopup="dialog"
      onPointerDown={(event) => { if (event.button !== 0) return; dragged.current = false; pointerStart.current = { id: event.pointerId, x: event.clientX, y: event.clientY }; event.currentTarget.setPointerCapture(event.pointerId); }}
      onPointerMove={trackPointer} onPointerUp={(event) => { trackPointer(event); pointerStart.current = null; }}
      onPointerCancel={() => { dragged.current = true; pointerStart.current = null; }} onKeyDown={stop}
      onClick={(event) => { stop(event); if (event.detail === 0 || !dragged.current) changeOpen(true); }}>
      {results.length ? results.map((result) => <span key={JSON.stringify([result.source, result.id])} className={result.result ? "assessment-pass" : "assessment-fail"}
        aria-label={`${result.date}: ${result.result ? "Pass" : "Fail"}`}>{result.result ? "✓" : "●"}</span>)
        : history.loading || history.error || history.data?.history.state === "incomplete"
          ? <span className="assessment-empty" aria-hidden="true">{history.loading ? "…" : "!"}</span>
          : <span className="assessment-empty-control" aria-hidden="true"><span>+</span> Test</span>}
    </button>
    <span id={descriptionId} hidden>{results.map((result) => `${result.date}: ${result.result ? "Pass" : "Fail"}`).join(", ")}</span>
    {open ? <AssessmentModal context={context} history={history} onClose={() => changeOpen(false)} /> : null}
  </>;
}

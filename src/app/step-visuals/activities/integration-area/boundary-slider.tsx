import { useCallback, useEffect, useId, useLayoutEffect, useRef, type Dispatch } from "react";
import { boundaryBounds, effectiveRegion, type IntegrationAction, type IntegrationState } from "./learning";
import { formatValue } from "./model";
import styles from "./later-stages.module.css";

/** Later-stage range adapter. Only Stage 5 requests whole-number settlement. */
export default function BoundarySlider({ state, active, dispatch }: { state: IntegrationState; active: boolean; dispatch: Dispatch<IntegrationAction> }) {
  const id = useId();
  const owner = useRef<{ id: number; revision: number; pointer: number } | null>(null);
  const cancelled = useRef(false);
  const cancel = useCallback(() => {
    const transaction = owner.current; owner.current = null;
    if (transaction) { cancelled.current = true; dispatch({ type: "cancel", revision: transaction.revision, id: transaction.id }); }
  }, [dispatch]);
  useLayoutEffect(() => { if (owner.current && (!active || state.revision !== owner.current.revision)) cancel(); }, [active, state.revision, cancel]);
  useEffect(() => {
    const hidden = () => { if (document.hidden) cancel(); };
    window.addEventListener("resize", cancel); window.addEventListener("blur", cancel);
    window.visualViewport?.addEventListener("resize", cancel); document.addEventListener("visibilitychange", hidden);
    return () => { window.removeEventListener("resize", cancel); window.removeEventListener("blur", cancel); window.visualViewport?.removeEventListener("resize", cancel); document.removeEventListener("visibilitychange", hidden); };
  }, [cancel]);
  const bounds = boundaryBounds(state, "b");
  if (!bounds) return null;
  const formatted = formatValue(effectiveRegion(state).b, 2);
  const readout = `b ${formatted.approximate ? "≈" : "="} ${formatted.text}`;
  return <div className={styles.range}>
    <label htmlFor={id}>{state.stage === 6 ? "Right boundary: b" : "Right boundary: x = b"} <span>{readout}</span></label>
    <input id={id} type="range" min={bounds[0]} max={bounds[1]} step="any" value={effectiveRegion(state).b}
      disabled={!active || (!!state.edit && (state.edit.source !== "range" || state.edit.settleTo !== undefined))}
      aria-valuetext={readout}
      onPointerDown={(event) => {
        if (!active || state.edit || owner.current || !event.isPrimary || event.button !== 0) return;
        try { event.currentTarget.setPointerCapture(event.pointerId); } catch { return; }
        cancelled.current = false;
        owner.current = { id: state.lastEditId + 1, revision: state.revision, pointer: event.pointerId };
        dispatch({ type: "begin", revision: state.revision, id: owner.current.id, source: "range", boundary: "b" });
      }}
      onChange={(event) => {
        if (cancelled.current) return;
        const transaction = owner.current;
        if (transaction) dispatch({ type: "preview", revision: transaction.revision, id: transaction.id, value: Number(event.target.value) });
        else dispatch({ type: "place", revision: state.revision, boundary: "b", value: Number(event.target.value), input: "value" });
      }}
      onPointerUp={(event) => {
        const transaction = owner.current;
        if (!transaction || transaction.pointer !== event.pointerId) return;
        owner.current = null;
        dispatch({ type: "release", revision: transaction.revision, id: transaction.id, value: Number(event.currentTarget.value) });
      }}
      onPointerCancel={cancel} onLostPointerCapture={(event) => { if (event.target === event.currentTarget) cancel(); }} onBlur={cancel}
      onFocus={() => { if (!owner.current) cancelled.current = false; }}
      onKeyDown={(event) => {
        if (event.key === "Escape") { cancel(); return; }
        if (state.edit) return;
        cancelled.current = false;
        const step = state.stage === 5 ? 1 : 0.1;
        const value = event.key === "Home" ? bounds[0] : event.key === "End" ? bounds[1] : ["ArrowRight", "ArrowUp"].includes(event.key) ? state.region.b + step : ["ArrowLeft", "ArrowDown"].includes(event.key) ? state.region.b - step : null;
        if (value !== null) { event.preventDefault(); dispatch({ type: "place", revision: state.revision, boundary: "b", value: Math.round(value * 10) / 10, input: "keyboard" }); }
      }} />
    <div className={styles.rangeEnds} aria-hidden="true"><span>{bounds[0]}</span><span>{bounds[1]}</span></div>
  </div>;
}

import { useCallback, useEffect, useId, useLayoutEffect, useRef } from "react";
import { effectiveRectangleCount } from "./learning";
import { divisionCounts } from "./model";
import type { StageProps } from "./stage-controls";
import styles from "./later-stages.module.css";

/** Six-stop partition control, deliberately independent of Stage 2's logarithmic track. */
export default function DivisionRefinementSlider({ state, active, dispatch }: StageProps) {
  const id = useId(), count = effectiveRectangleCount(state);
  const owner = useRef<{ id: number; revision: number; pointer: number } | null>(null);
  const cancelled = useRef(false);
  const cancel = useCallback(() => {
    const edit = owner.current; owner.current = null;
    if (edit) { cancelled.current = true; dispatch({ type: "cancel", id: edit.id, revision: edit.revision }); }
  }, [dispatch]);
  useLayoutEffect(() => { if (owner.current && (!active || owner.current.revision !== state.revision)) cancel(); }, [active, state.revision, cancel]);
  useEffect(() => {
    const hidden = () => { if (document.hidden) cancel(); };
    window.addEventListener("blur", cancel); window.addEventListener("resize", cancel); document.addEventListener("visibilitychange", hidden);
    window.visualViewport?.addEventListener("resize", cancel);
    return () => { window.removeEventListener("blur", cancel); window.removeEventListener("resize", cancel); document.removeEventListener("visibilitychange", hidden); window.visualViewport?.removeEventListener("resize", cancel); };
  }, [cancel]);
  const decode = (value: string) => divisionCounts[Number(value)];
  return <div className={styles.range}>
    <label htmlFor={id}>Rectangle width <span>{count} rectangles</span></label>
    <input id={id} type="range" min={0} max={5} step={1} value={divisionCounts.indexOf(count as typeof divisionCounts[number])} aria-valuetext={`${count} rectangles`} disabled={!active || !!state.edit && state.edit.boundary !== "rectangles"}
      onPointerDown={event => {
        if (!active || state.edit || owner.current || !event.isPrimary || event.button !== 0) return;
        try { event.currentTarget.setPointerCapture(event.pointerId); } catch { return; }
        cancelled.current = false; owner.current = { id: state.lastEditId + 1, revision: state.revision, pointer: event.pointerId };
        dispatch({ type: "begin", boundary: "rectangles", source: "range", id: owner.current.id, revision: state.revision });
      }} onChange={event => {
        if (cancelled.current) return;
        const edit = owner.current;
        dispatch(edit ? { type: "preview", id: edit.id, revision: edit.revision, value: decode(event.target.value) } : { type: "refine", revision: state.revision, rectangles: decode(event.target.value) });
      }} onPointerUp={event => {
        const edit = owner.current; if (!edit || edit.pointer !== event.pointerId) return; owner.current = null;
        dispatch({ type: "commit", id: edit.id, revision: edit.revision, value: decode(event.currentTarget.value) });
      }} onPointerCancel={cancel} onLostPointerCapture={event => { if (event.target === event.currentTarget) cancel(); }} onBlur={cancel}
      onFocus={() => { if (!owner.current) cancelled.current = false; }} onKeyDown={event => { if (event.key === "Escape") cancel(); else if (!owner.current) cancelled.current = false; }} />
    <div className={styles.rangeEnds} aria-hidden="true"><span>Wider</span><span>Narrower</span></div>
  </div>;
}

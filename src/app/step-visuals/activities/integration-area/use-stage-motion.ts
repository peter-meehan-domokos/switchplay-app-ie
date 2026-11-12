import { useEffect, useRef, type Dispatch } from "react";
import type { IntegrationAction, IntegrationState } from "./learning";

/** Final correction: halve the previously approved 4,280ms start delay only. */
export const STAGE_THREE_START_DELAY_MS = 2140;
export const STAGE_THREE_ANIMATION_DURATION_MS = 900;
export const BOUNDARY_SETTLEMENT_DURATION_MS = 150;

/** Browser time feeds the sole reducer-owned mathematical animation/transaction. */
export function useStageMotion(state: IntegrationState, active: boolean, dispatch: Dispatch<IntegrationAction>) {
  const latest = useRef(state);
  useEffect(() => { latest.current = state; });
  const clock = useRef({ run: "", elapsed: 0 });
  const settling = state.edit?.settleTo, editId = state.edit?.id;
  const compare = state.stage === 3 && state.demonstration < 1;
  const run = state.records.current.attemptId + ":" + state.comparisonRun;
  useEffect(() => {
    if (!active || (!compare && settling === undefined)) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const start = latest.current;
    if (compare && clock.current.run !== run) clock.current = { run, elapsed: 0 };
    const from = compare ? 0 : start.edit!.candidate, target = compare ? 1 : settling!;
    const delay = compare ? STAGE_THREE_START_DELAY_MS : 0;
    const duration = compare ? STAGE_THREE_ANIMATION_DURATION_MS : BOUNDARY_SETTLEMENT_DURATION_MS;
    let frame = 0, began = performance.now(), interrupted = false, paused = document.hidden;
    let elapsed = compare ? clock.current.elapsed : 0;
    const tick = (now: number) => {
      if (interrupted || paused) return;
      const time = elapsed + now - began;
      const progress = reduced.matches ? 1 : Math.min(1, Math.max(0, (time - delay) / duration));
      const value = from + (target - from) * (1 - (1 - progress) ** 3);
      if (compare) dispatch({ type: "demonstrate", revision: start.revision, progress: value });
      else dispatch({ type: progress === 1 ? "commit" : "preview", revision: start.revision, id: editId!, value: progress === 1 ? target : value });
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    const interrupt = () => {
      if (compare) return;
      interrupted = true; cancelAnimationFrame(frame);
      dispatch({ type: "cancel", revision: start.revision, id: editId! });
    };
    const visibility = () => {
      if (!compare) { if (document.hidden) interrupt(); return; }
      if (document.hidden && !paused) {
        elapsed += performance.now() - began; paused = true; cancelAnimationFrame(frame);
      } else if (!document.hidden && paused) {
        began = performance.now(); paused = false; frame = requestAnimationFrame(tick);
      }
    };
    window.addEventListener("resize", interrupt); window.addEventListener("blur", interrupt);
    window.visualViewport?.addEventListener("resize", interrupt); document.addEventListener("visibilitychange", visibility);
    if (!paused) frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      if (compare) clock.current = { run, elapsed: elapsed + (paused ? 0 : performance.now() - began) };
      window.removeEventListener("resize", interrupt); window.removeEventListener("blur", interrupt);
      window.visualViewport?.removeEventListener("resize", interrupt); document.removeEventListener("visibilitychange", visibility);
    };
  }, [active, compare, state.revision, run, settling, editId, dispatch]);
}

import { useCallback, useEffect, useId, useLayoutEffect, useRef, type Dispatch, type RefObject } from "react";
import { canGoPrevious, effectiveRectangleCount, effectiveRegion, type IntegrationAction, type IntegrationState } from "./learning";
import { estimatedExplanation, type IntegrationPresentation, type TermText } from "./presentation";
import { stageOneReadout } from "./display-policy";
import Tooltip from "../../platform/web/tooltip";
import IntegrationGraph from "./integration-graph";
import styles from "./intro-stages.module.css";

/** Native range input adapter. Candidate mathematics remains in the activity reducer. */
function IntroRange({ state, active, dispatch, target }: { state: IntegrationState; active: boolean; dispatch: Dispatch<IntegrationAction>; target: "b" | "rectangles" }) {
  const id = useId();
  const count = effectiveRectangleCount(state);
  const decode = (value: string) => target === "b" ? Number(value) : Math.round(2 ** Number(value));
  const owner = useRef<{ id: number; revision: number; pointer: number; target: HTMLInputElement } | null>(null);
  const cancelledPointer = useRef<number | null>(null);
  const cancel = useCallback(() => {
    const transaction = owner.current;
    owner.current = null;
    if (transaction) {
      cancelledPointer.current = transaction.pointer;
      dispatch({ type: "cancel", revision: transaction.revision, id: transaction.id });
    }
  }, [dispatch]);
  useLayoutEffect(() => {
    if (owner.current && (!active || owner.current.revision !== state.revision)) cancel();
  }, [active, state.revision, cancel]);
  useEffect(() => {
    const hidden = () => { if (document.hidden) cancel(); };
    window.addEventListener("blur", cancel);
    window.addEventListener("resize", cancel);
    window.visualViewport?.addEventListener("resize", cancel);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("blur", cancel);
      window.removeEventListener("resize", cancel);
      window.visualViewport?.removeEventListener("resize", cancel);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [cancel]);
  return <div className={styles.rangeGroup}>
    <label htmlFor={id}>{target === "b" ? "Right boundary" : <>Rectangle width <span>Rectangles: {count}</span></>}</label>
    <input id={id} type="range" min={0} max={target === "b" ? 4 : 7} step="any"
      value={target === "b" ? effectiveRegion(state).b : Math.log2(count)} aria-valuetext={target === "rectangles" ? `${count} rectangles` : `b = ${stageOneReadout(effectiveRegion(state).b).boundaryText}`}
      disabled={!active || (!!state.edit && state.edit.source !== "range")}
      onPointerDown={(event) => {
        if (!active || state.edit || owner.current || !event.isPrimary || event.button !== 0) return;
        const transaction = { id: state.lastEditId + 1, revision: state.revision, pointer: event.pointerId, target: event.currentTarget };
        // Keep native track-tap/drag behaviour; capture only contains its transaction.
        try { event.currentTarget.setPointerCapture(event.pointerId); } catch { return; }
        cancelledPointer.current = null;
        owner.current = transaction;
        dispatch({ type: "begin", boundary: target, id: transaction.id, revision: transaction.revision, source: "range" });
      }}
      onChange={(event) => {
        // Native range events can continue after Escape, capture loss or suspension.
        if (cancelledPointer.current !== null) return;
        const transaction = owner.current;
        if (transaction) dispatch({ type: "preview", id: transaction.id, revision: transaction.revision, value: decode(event.target.value) });
        else if (target === "rectangles") dispatch({ type: "refine", rectangles: decode(event.target.value), revision: state.revision });
        else dispatch({ type: "place", boundary: "b", value: decode(event.target.value), input: "value", revision: state.revision });
      }}
      onPointerUp={(event) => {
        const transaction = owner.current;
        if (!transaction || transaction.pointer !== event.pointerId) return;
        owner.current = null;
        dispatch({ type: "commit", id: transaction.id, revision: transaction.revision, value: decode(event.currentTarget.value) });
      }}
      onPointerCancel={cancel} onLostPointerCapture={(event) => { if (event.target === event.currentTarget) cancel(); }} onBlur={cancel}
      onFocus={() => { if (!owner.current) cancelledPointer.current = null; }}
      onKeyDown={(event) => {
        if (event.key === "Escape") { cancel(); return; }
        if (state.edit) return;
        cancelledPointer.current = null;
        if (target === "rectangles") {
          const rectangles = event.key === "Home" ? 1 : event.key === "End" ? 128 : ["ArrowRight", "ArrowUp"].includes(event.key) ? Math.min(128, count + 1) : ["ArrowLeft", "ArrowDown"].includes(event.key) ? Math.max(1, count - 1) : null;
          if (rectangles !== null) { event.preventDefault(); dispatch({ type: "refine", rectangles, revision: state.revision }); }
          return;
        }
        const value = event.key === "Home" ? 0 : event.key === "End" ? 4 : ["ArrowRight", "ArrowUp"].includes(event.key) ? Math.round((state.region.b + 0.1) * 10) / 10 : ["ArrowLeft", "ArrowDown"].includes(event.key) ? Math.round((state.region.b - 0.1) * 10) / 10 : null;
        if (value !== null) { event.preventDefault(); dispatch({ type: "place", boundary: "b", value, input: "keyboard", revision: state.revision }); }
      }} />
    <div className={styles.ends} aria-hidden="true"><span>{target === "b" ? "0" : "Wider"}</span><span>{target === "b" ? "4" : "Narrower"}</span></div>
  </div>;
}

function ExplainedText({ parts, active }: { parts: TermText; active: boolean }) {
  return <>{parts.map((part, index) => part.explanation === "estimated"
    ? <Tooltip key={index} title={estimatedExplanation.title} content={estimatedExplanation.content} disabled={!active}>{part.text}</Tooltip>
    : <span key={index}>{part.text}</span>)}</>;
}

/** Activity-specific composition: no changes to shared frames or the later-stage renderer. */
export default function IntroStages({ state, presentation, active, dispatch, headingRef, onExit }: {
  state: IntegrationState; presentation: IntegrationPresentation; active: boolean; dispatch: Dispatch<IntegrationAction>;
  headingRef: RefObject<HTMLHeadingElement | null>; onExit?: () => void;
}) {
  const context = { revision: state.revision };
  const disabled = !active || !!state.edit;
  return <div className={styles.frame} data-integration-intro>
    <header className={styles.heading}><h1 ref={headingRef} tabIndex={-1} data-spv-experience-heading>{presentation.heading}</h1>
      {onExit ? <button type="button" onClick={() => dispatch({ ...context, type: "exit" })}>Exit</button> : null}</header>
    {state.stage === 2 ? <div className={styles.selector} role="group" aria-label="Graph selector">
      {(["flat", "rising"] as const).map((kind) => <button key={kind} type="button" disabled={disabled} aria-pressed={state.function === kind}
        onClick={() => dispatch({ ...context, type: "function", function: kind })}>{kind === "flat" ? "y = 2" : "y = x"}</button>)}
    </div> : null}
    <p className={styles.instruction}>{presentation.instructionParts ? <ExplainedText parts={presentation.instructionParts} active={active} /> : presentation.instruction}</p>
    <IntegrationGraph className={styles.graph} state={state} active={active} dispatch={dispatch} />
    <IntroRange key={state.stage} target={state.stage === 1 ? "b" : "rectangles"} state={state} active={active} dispatch={dispatch} />
    <div className={styles.math}>
      {presentation.areaFeedback ? <>
        <div className={styles.feedbackLabel}>{presentation.areaFeedback.label}</div>
        <p role="math" aria-label={`${presentation.areaFeedback.calculation} ${presentation.areaFeedback.units}. ${presentation.areaFeedback.description}`}>{presentation.areaFeedback.calculation} {presentation.areaFeedback.units}</p>
      </> : presentation.lines.map((line, index) => <p key={index}>{line.parts ? <ExplainedText parts={line.parts} active={active} /> : line.text}</p>)}
    </div>
    <p className={styles.insight}>{presentation.note}</p>
    <nav className={styles.navigation} aria-label="Activity progression">
      <button type="button" disabled={disabled || !canGoPrevious(state)} onClick={() => dispatch({ ...context, type: "previous" })}><span aria-hidden="true">← </span>Previous</button>
      <button type="button" disabled={disabled || !presentation.nextEnabled}
      onClick={() => dispatch({ ...context, type: "next" })}>Next <span aria-hidden="true">→</span></button></nav>
  </div>;
}

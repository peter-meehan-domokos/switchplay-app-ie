import { useId, type Dispatch } from "react";
import { canFinish, canGoPrevious, type IntegrationAction, type IntegrationState } from "./learning";
import { type IntegrationFunction, type GrowthFunction } from "./model";
import { selectionLabel } from "./math-presentation";
import { createIntegrationAttemptId } from "./notifications";
import styles from "./later-stages.module.css";

export type StageProps = { state: IntegrationState; active: boolean; dispatch: Dispatch<IntegrationAction> };
export function FunctionTabs({ state, active, dispatch }: StageProps) {
  if (state.stage === 4) return <div className={styles.selector} role="group" aria-label="Graph selector">{(["rising", "square", "rule"] as const).map(subsection => <button key={subsection} type="button" disabled={!active || !!state.edit} aria-pressed={state.divisionSubsection === subsection} onClick={() => dispatch({ type: "division-subsection", revision: state.revision, subsection })}>{subsection === "rule" ? "The rule" : selectionLabel(subsection)}</button>)}</div>;
  const choices: readonly GrowthFunction[] = state.stage === 3 ? ["flat", "rising", "square"] : ["rising", "square"];
  return <div className={styles.selector} role="group" aria-label="Graph selector">{choices.map(kind => <button key={kind} type="button" disabled={!active || !!state.edit} aria-pressed={state.function === kind} onClick={() => dispatch({ type: "function", revision: state.revision, function: kind })}>{selectionLabel(kind)}</button>)}</div>;
}
export function CurveChoices({ state, active, dispatch, stacked = false }: StageProps & { stacked?: boolean }) {
  const id = useId();
  const choices: readonly IntegrationFunction[] = state.stage === 6 ? ["rising", "lower", "axis"] : ["upper", "parabola", "axis"];
  return <div className={`${styles.curveChoices} ${stacked ? styles.stackedCurves : ""}`}>{(["top", "bottom"] as const).map((slot, index) => <label key={slot} htmlFor={`${id}-${slot}`}>
    {index === 0 ? "First curve" : "Second curve"}
    <select id={`${id}-${slot}`} disabled={!active || !!state.edit} value={state.region.curves[index]} onChange={event => dispatch({ type: "select", revision: state.revision, boundary: slot, value: event.target.value as IntegrationFunction })}>
      {choices.map(curve => <option key={curve} value={curve}>{selectionLabel(curve)}</option>)}
    </select>
  </label>)}</div>;
}
export function StageNavigation({ state, active, dispatch, nextEnabled }: StageProps & { nextEnabled: boolean }) {
  const finished = state.part === "finished", disabled = !active || !!state.edit;
  return <nav className={styles.navigation} aria-label="Activity progression">
    {finished ? <span /> : <button key="previous" type="button" disabled={disabled || !canGoPrevious(state)} onClick={() => dispatch({ type: "previous", revision: state.revision })}><span aria-hidden="true">← </span>Previous</button>}
    {finished ? <button key="restart" type="button" disabled={!active} onClick={() => dispatch({ type: "restart", revision: state.revision, attemptId: createIntegrationAttemptId() })}>Start again</button>
      : state.stage === 7 ? <button key="finish" type="button" disabled={disabled || !canFinish(state)} onClick={() => dispatch({ type: "finish", revision: state.revision })}>Finish</button>
      : <button key="next" type="button" disabled={disabled || !nextEnabled} onClick={event => { event.preventDefault(); dispatch({ type: "next", revision: state.revision }); }}>Next<span aria-hidden="true"> →</span></button>}
  </nav>;
}

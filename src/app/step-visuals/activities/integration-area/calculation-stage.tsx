import { useId, useRef } from "react";
import Tooltip from "../../platform/web/tooltip";
import MathValue, { Integral } from "./math-value";
import { parseCalculation } from "./learning";
import type { LaterMathScene } from "./math-presentation";
import type { IntegrationPresentation } from "./presentation";
import { CurveChoices, type StageProps } from "./stage-controls";
import WorkedCalculation from "./worked-calculation";
import styles from "./later-stages.module.css";

export default function CalculationStage(props: StageProps & { presentation: IntegrationPresentation; mathematics: LaterMathScene }) {
  const { state, active, dispatch, presentation, mathematics } = props;
  const id = useId(), answer = useRef<HTMLInputElement>(null);
  const context = { revision: state.revision };
  if (state.part === "finished") return <div className={styles.recap}>
    <div><h2>{presentation.subheading}</h2><p>{mathematics.recapRegion}</p><p>{mathematics.recapInterval}</p></div>
    <p className={styles.recapHeight}>Strip height: <MathValue parts={mathematics.height} /></p>
    <WorkedCalculation scene={mathematics.worked!} integral={presentation.integral!} />
    {!state.checked!.correct ? <div><p>Your answer: {mathematics.submitted} square units</p><p>Correct area: {state.checked!.expected} square units</p></div> : null}
  </div>;
  return <>
    <section className={styles.setupSection}><h2>Choose what area to measure</h2><CurveChoices {...props} /></section>
    <section className={styles.setupSection}><h2>Choose where to measure</h2>
      <div className={styles.intervals} role="radiogroup" aria-label="Interval">{[[0, 1], [1, 2], [0, 2]].map(([a, b]) => <label key={`${a}-${b}`}><input type="radio" name={`${id}-interval`} disabled={!active} checked={state.region.a === a && state.region.b === b} onChange={() => dispatch({ ...context, type: "interval", a, b })} /><span>From {a} to {b}</span></label>)}</div>
    </section>
    <section className={styles.setupSection}><h2>Calculate the area</h2><Integral integral={presentation.integral!} />
      <form onSubmit={event => { event.preventDefault(); if (!active) return; dispatch({ ...context, type: "check" }); if (parseCalculation(state.draft) !== null) answer.current?.blur(); }} className={styles.calculation}>
        <label htmlFor={`${id}-answer`}>Your answer</label>
        <div className={styles.answerRow}><input ref={answer} id={`${id}-answer`} className={styles.answer} type="text" inputMode="decimal" enterKeyHint="done" autoComplete="off" value={state.draft} disabled={!active}
          aria-invalid={state.feedback === "incorrect" || state.feedback === "invalid" || state.feedback === "empty" || undefined} aria-describedby={state.feedback ? `${id}-feedback` : undefined}
          onFocus={event => { const target = event.currentTarget; requestAnimationFrame(() => { const view = window.visualViewport; const box = target.getBoundingClientRect(); if (view && box.bottom > view.offsetTop + view.height - 56) target.scrollIntoView({ block: "center", behavior: "instant" }); }); }}
          onChange={event => dispatch({ ...context, type: "draft", value: event.target.value })} />
          <button type="submit" disabled={!active}>Check calculation</button>
        </div>
      </form>
    </section>
    <div className={styles.calculationFeedback}>
      <p id={`${id}-feedback`} className={styles.feedback}>{presentation.feedback}</p>
      {state.feedback === "incorrect" ? <span className={styles.optionalTerm}><Tooltip key={state.problemRevision} title="Hint" content={state.region.curves[0] === state.region.curves[1] ? presentation.hint : <span className={styles.tooltipMath}>
        <span>{presentation.hint}</span>
        <span className={styles.hintEquation} role="math" aria-label="Area equals Upper value at x equals b minus Lower value at x equals a">
          <span aria-hidden="true">Area =</span><span className={styles.hintTerm} aria-hidden="true">Upper value <small>(<i>x</i> = <i>b</i>)</small></span>
          <span aria-hidden="true">−</span><span className={styles.hintTerm} aria-hidden="true">Lower value <small>(<i>x</i> = <i>a</i>)</small></span>
        </span>
      </span>} maxWidth={state.region.curves[0] === state.region.curves[1] ? undefined : 380} disabled={!active} onOpen={() => dispatch({ ...context, type: "help" })}>Show hint</Tooltip></span> : null}
    </div>
  </>;
}

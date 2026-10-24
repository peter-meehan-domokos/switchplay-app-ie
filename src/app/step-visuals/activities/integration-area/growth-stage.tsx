import MathValue from "./math-value";
import type { LaterMathScene } from "./math-presentation";
import type { IntegrationPresentation } from "./presentation";
import type { StageProps } from "./stage-controls";
import styles from "./later-stages.module.css";

export default function GrowthStage({ state, active, dispatch, presentation, mathematics }: StageProps & { presentation: IntegrationPresentation; mathematics: LaterMathScene }) {
  const revealed = state.demonstration === 1;
  return <>
    <div className={styles.growthQuestion}>{revealed ? <>
      <p className={styles.question}>{presentation.question}</p>
      <div className={styles.choices} role="group" aria-label={presentation.question}>{presentation.choices.map(choice => <button key={choice.multiplier} type="button" aria-pressed={state.prediction?.multiplier === choice.multiplier} disabled={!active || !!state.prediction} onClick={() => dispatch({ type: "predict", revision: state.revision, multiplier: choice.multiplier })}>{choice.label}</button>)}</div>
    </> : null}</div>
    {revealed && state.prediction ? <div className={styles.comparison}>
      <p className={styles.feedback}>{presentation.feedback}</p>
      {mathematics.comparison.length ? <div className={styles.comparisonValues}>{mathematics.comparison.map(item => <div key={item.label}><span>{item.label}</span><MathValue parts={item.expression} units="square units" /></div>)}</div> : null}
      {presentation.note ? <p className={styles.note}>{presentation.note}</p> : null}
      {presentation.paragraphs?.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
      <p className={styles.transition}>{presentation.transition}</p>
    </div> : null}
  </>;
}

import type { WorkedAreaScene } from "./math-presentation";
import type { IntegrationPresentation } from "./presentation";
import MathValue, { Integral } from "./math-value";
import styles from "./later-stages.module.css";

/** Four declarative mathematical lines; all algebra and numerical values are prepared upstream. */
export default function WorkedCalculation({ scene, integral }: { scene: WorkedAreaScene; integral: NonNullable<IntegrationPresentation["integral"]> }) {
  return <div className={styles.workedCalculation} data-worked-calculation>
    <div data-worked-line="integral"><Integral integral={integral} /></div>
    <div data-worked-line="evaluation" className={styles.evaluation} role="math" aria-label={`Equals [${scene.integrated}] evaluated from ${scene.a} to ${scene.b}`}>
      <span aria-hidden="true">= [{scene.integrated}]</span><span className={styles.evaluationBounds} aria-hidden="true"><span>{scene.b}</span><span>{scene.a}</span></span>
    </div>
    <div data-worked-line="substitution"><MathValue parts={[{ text: "= " + scene.substitution }]} /></div>
    <div data-worked-line="subtraction"><MathValue parts={[{ text: "= " + scene.subtraction }]} units="square units" /></div>
  </div>;
}

import BoundarySlider from "./boundary-slider";
import MathValue, { Integral } from "./math-value";
import type { LaterMathScene } from "./math-presentation";
import type { IntegrationPresentation } from "./presentation";
import { CurveChoices, type StageProps } from "./stage-controls";
import styles from "./later-stages.module.css";

export default function BetweenCurvesStage(props: StageProps & { presentation: IntegrationPresentation; mathematics: LaterMathScene }) {
  const { presentation, mathematics } = props;
  return <>
    <div className={styles.betweenControls}><CurveChoices {...props} stacked /><BoundarySlider {...props} /></div>
    <p>{presentation.note}</p>
    {mathematics.strip.length ? <MathValue parts={mathematics.strip} /> : null}
    <div className={styles.stripIntegral}><p>Add these narrow strips using integration:</p><Integral integral={presentation.integral!} prefix="Area =" /></div>
  </>;
}

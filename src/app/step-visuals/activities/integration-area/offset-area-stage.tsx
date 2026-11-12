import Tooltip from "../../platform/web/tooltip";
import BoundarySlider from "./boundary-slider";
import MathValue from "./math-value";
import type { LaterMathScene } from "./math-presentation";
import type { IntegrationPresentation } from "./presentation";
import type { StageProps } from "./stage-controls";
import styles from "./later-stages.module.css";

export default function OffsetAreaStage(props: StageProps & { presentation: IntegrationPresentation; mathematics: LaterMathScene }) {
  const { active, presentation, mathematics } = props;
  return <>
    <div><p>{presentation.note}</p><BoundarySlider {...props} /></div>
    <div className={styles.geometricSteps}>{mathematics.triangles.map(item => <div key={item.label}><p>{item.label}</p><MathValue parts={item.expression} units={item.units} /></div>)}</div>
    <p className={styles.constant}>The small triangle always has area ½. So we always subtract ½. This gives us a <span className={styles.optionalTerm}><Tooltip title="Why is it a constant?" disabled={!active} content={<span className={styles.tooltipMath}>
      <span>The starting point stays at 1, so we always leave out the same area.</span>
      <span>That makes −1/2 a fixed term in our area formula:</span><MathValue parts={mathematics.constant} />
      <span>A different starting point would give a different constant.</span>
    </span>}>constant of integration</Tooltip></span>, <MathValue parts={mathematics.fixedTerm} />.</p>
  </>;
}

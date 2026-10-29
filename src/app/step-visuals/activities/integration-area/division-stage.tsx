import Tooltip from "../../platform/web/tooltip";
import MathValue, { IndefiniteIntegral } from "./math-value";
import { powerRuleScenes, type LaterMathScene } from "./math-presentation";
import type { IntegrationPresentation } from "./presentation";
import type { StageProps } from "./stage-controls";
import DivisionRefinementSlider from "./division-refinement-slider";
import styles from "./later-stages.module.css";

export default function DivisionStage(props: StageProps & { presentation: IntegrationPresentation; mathematics: LaterMathScene }) {
  const { state, active, presentation, mathematics: { division } } = props;
  return state.function === "rising" ? <>
    <div><p>Whole rectangle</p><MathValue parts={division.rectangle} /></div>
    <div><p>Shaded triangle</p><MathValue parts={division.half} /></div>
    <MathValue parts={division.formula} />
    <div className={styles.ruleAside}><p>A glimpse of the rule:</p><IndefiniteIntegral scene={powerRuleScenes.linear} /></div>
  </> : <>
    <DivisionRefinementSlider {...props} />
    <div className={styles.estimates}><p>Estimate from below <strong>≈ {division.lower}</strong></p><p>Estimate from above <strong>≈ {division.upper}</strong></p></div>
    <p>{presentation.note}</p><MathValue parts={division.formula} />
    <span className={styles.optionalTerm}><Tooltip title="Why exactly one-third?" disabled={!active} content={<span className={styles.tooltipMath}>
      <span>The rectangles suggest that the area is one-third of the whole rectangle. Differentiation confirms it.</span>
      <span>The area grows at a rate equal to the graph&apos;s height, b²:</span>
      <MathValue parts={division.derivative} />
      <span>Since the area starts at zero, its exact value is <MathValue parts={[{ numerator: "b³", denominator: "3" }]} />.</span>
      <span>We&apos;ll explore this connection in another lesson.</span>
    </span>}>Why exactly one-third?</Tooltip></span>
  </>;
}

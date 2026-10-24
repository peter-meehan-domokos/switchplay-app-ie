import { useMemo, type RefObject } from "react";
import IntegrationGraph from "./integration-graph";
import { laterMathLayout } from "./math-presentation";
import type { IntegrationPresentation } from "./presentation";
import GrowthStage from "./growth-stage";
import DivisionStage from "./division-stage";
import DivisionRule from "./division-rule";
import OffsetAreaStage from "./offset-area-stage";
import BetweenCurvesStage from "./between-curves-stage";
import CalculationStage from "./calculation-stage";
import { FunctionTabs, StageNavigation, type StageProps } from "./stage-controls";
import styles from "./later-stages.module.css";

export default function LaterStages(props: StageProps & {
  presentation: IntegrationPresentation; headingRef: RefObject<HTMLHeadingElement | null>; onExit?: () => void;
}) {
  const { state, presentation, active, dispatch, headingRef, onExit } = props;
  const mathematics = useMemo(() => laterMathLayout(state), [state]);
  const content = { ...props, mathematics };
  const subsections = state.stage === 3 || state.stage === 4;
  const rule = state.stage === 4 && state.divisionSubsection === "rule";
  return <div className={styles.frame} data-integration-later data-stage={state.stage} data-rule={rule || undefined}>
    <header className={styles.heading}><h1 tabIndex={-1} ref={headingRef} data-spv-experience-heading>{presentation.heading}</h1>{onExit ? <button type="button" onClick={() => dispatch({ type: "exit", revision: state.revision })}>Exit</button> : null}</header>
    {subsections ? <div className={styles.top}><FunctionTabs {...props} /></div> : null}
    <p className={styles.instruction}>{presentation.instruction}</p>
    {!subsections ? <div className={styles.top} /> : null}
    {!rule ? <IntegrationGraph state={state} active={active} dispatch={dispatch} className={styles.graph} /> : null}
    <div className={styles.panel}>
      {state.stage === 3 ? <GrowthStage {...content} /> : rule ? <DivisionRule presentation={presentation} /> : state.stage === 4 ? <DivisionStage {...content} /> : state.stage === 5 ? <OffsetAreaStage {...content} /> : state.stage === 6 ? <BetweenCurvesStage {...content} /> : <CalculationStage {...content} />}
    </div>
    <StageNavigation {...props} nextEnabled={presentation.nextEnabled} />
  </div>;
}

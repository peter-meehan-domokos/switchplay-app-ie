"use client";

import { useMemo } from "react";
import ActivityFrame from "../../platform/web/ActivityFrame";
import MathGraph from "../../platform/web/Graph";
import FactorExpression from "../../platform/web/FactorExpression";
import ActivityPrompt from "../../platform/web/ActivityPrompt";
import RootAdjustmentControls from "../../platform/web/RootAdjustmentControls";
import { useGraphMeasurement } from "../../platform/web/measurement";
import styles from "../../platform/web/MathUI.module.css";
import { rootsFactorsLayout } from "./rootsFactorsLayout";
import type { RootsFactorsPresentation } from "./presentationLayouts";
import type { Card1Math } from "./model";

/** Shared activity presentation; no development selector, fixtures, reducer or gestures. */
export default function RootsFactorsView({ math, presentation, onExit }: { math: Card1Math; presentation: RootsFactorsPresentation; onExit?: () => void }) {
  const { ref, size } = useGraphMeasurement();
  const scene = useMemo(() => rootsFactorsLayout(math, size, presentation.policy), [math, size, presentation.policy]);
  return (
    <ActivityFrame
      title="Roots and factors" onExit={onExit}
      graph={<div className={styles.spvMeasuredGraph} ref={ref}><MathGraph scene={scene.graph} /></div>}
      expression={<FactorExpression scene={scene.expression} />}
      adjustments={presentation.adjustments ? <RootAdjustmentControls scene={presentation.adjustments} /> : null}
      prompt={<ActivityPrompt scene={presentation.prompt} />}
    />
  );
}

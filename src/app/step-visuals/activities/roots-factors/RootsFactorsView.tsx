"use client";

import { useMemo, useRef, type Dispatch } from "react";
import ActivityFrame from "../../platform/web/ActivityFrame";
import MathGraph from "../../platform/web/Graph";
import FactorExpression from "../../platform/web/FactorExpression";
import ActivityPrompt from "../../platform/web/ActivityPrompt";
import ActivityNavigation from "../../platform/web/ActivityNavigation";
import { useGraphMeasurement } from "../../platform/web/measurement";
import { useRootPointer } from "../../platform/web/useRootPointer";
import { keyboardRoot, type RootInputPolicy } from "../../core/interaction/rootInteraction";
import { factorExpressionSizingLayout } from "../../core/expressions/factorExpressionLayout";
import styles from "../../platform/web/MathUI.module.css";
import { rootsFactorsLayout, rootsFactorsPlaneLayout } from "./rootsFactorsLayout";
import { promptSizingScenes, activityNavigationSizingLayout, type RootsFactorsPresentation } from "./presentationLayouts";
import type { Card1GraphMath } from "./model";
import type { ManipulationAction, ManipulationState } from "./manipulation";

const safeExpressionSizingScene = factorExpressionSizingLayout();
const navigationSizingScene = activityNavigationSizingLayout();

/** Shared presentation and web-input bindings; no lab fixtures or learning transitions. */
export default function RootsFactorsView({ math, presentation, manipulation, onExit, onPromptAction, stageKey, announceEligibility }: {
  math: Card1GraphMath; presentation: RootsFactorsPresentation;
  manipulation: Readonly<{ state: ManipulationState; policy: RootInputPolicy; dispatch: Dispatch<ManipulationAction> }>;
  onExit?: () => void;
  onPromptAction?: (id: string) => void;
  stageKey?: string;
  announceEligibility?: boolean;
}) {
  const { ref, size, ready } = useGraphMeasurement();
  const svgRef = useRef<SVGSVGElement>(null);
  const { state, dispatch } = manipulation;
  const { enabled, bounds } = manipulation.policy;
  const inputPolicy = useMemo(() => ({ enabled: enabled && ready, bounds }), [enabled, bounds, ready]);
  const plane = useMemo(() => rootsFactorsPlaneLayout(size), [size]);
  const scene = useMemo(() => rootsFactorsLayout(math, size, presentation.policy, inputPolicy, plane), [math, size, presentation.policy, inputPolicy, plane]);
  const pointer = useRootPointer({ svgRef, projection: scene.graph.plane.projection, state, policy: inputPolicy, dispatch });
  const moving = scene.graph.roots.markers[1];
  const interaction = moving.interaction!;
  const target = moving.hitRegion!;
  const place = (root: number | null) => { if (root !== null) dispatch({ type: "place", revision: state.revision, root }); };
  return (
    <ActivityFrame
      title="Roots and factors" onExit={onExit}
      graph={<div className={styles.spvMeasuredGraph} ref={ref} data-spv-settled-root={state.math.movingRoot} data-spv-graphical-root={scene.graphicalRoot} data-spv-editing={state.edit !== null} data-spv-learning-stage={stageKey}>
        <MathGraph scene={scene.graph} svgRef={svgRef} />
        <div className={styles.spvRootSlider} role="slider" aria-label={interaction.accessibleName} aria-valuemin={interaction.bounds[0]} aria-valuemax={interaction.bounds[1]} aria-valuenow={interaction.value} aria-valuetext={interaction.valueText} aria-orientation="horizontal" aria-disabled={!interaction.enabled} tabIndex={interaction.enabled ? 0 : -1}
          style={{ left: target.x, top: target.y, width: target.width, height: target.height }} data-editing={state.edit !== null} {...pointer}
          onKeyDown={(event) => {
            const root = keyboardRoot(state.math.movingRoot, event.key, inputPolicy.bounds);
            if (root === null) return;
            event.preventDefault();
            if (inputPolicy.enabled) place(root);
          }} />
      </div>}
      expression={<FactorExpression scene={scene.expression} />}
      expressionSizing={<FactorExpression scene={safeExpressionSizingScene} />}
      navigation={<ActivityNavigation action={presentation.prompt.navigation} onAction={onPromptAction} />}
      navigationSizing={<ActivityNavigation action={navigationSizingScene} sizing />}
      prompt={<ActivityPrompt scene={presentation.prompt} onAction={onPromptAction} stageKey={stageKey} announceEligibility={announceEligibility} />}
      promptSizing={promptSizingScenes.map((prompt, index) => <ActivityPrompt key={index} scene={prompt} sizing />)}
    />
  );
}

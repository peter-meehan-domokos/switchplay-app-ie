"use client";

import { useCallback, useLayoutEffect, useMemo, useReducer } from "react";
import RootsFactorsView from "./RootsFactorsView";
import { effectiveMath, type ManipulationAction } from "./manipulation";
import { guidedPresentation } from "./presentationLayouts";
import { initialLearning, learningInputPolicy, learningReducer, type LearningAction, type LearningState } from "./learning";
import { useSurfaceActive } from "../../platform/web/SurfaceLifecycle";

export type RootsFactorsActivityProps = Readonly<{ onExit?: () => void; visible?: boolean }>;

/** Keep the state owner alive while a host hides the view; do not retain hidden solution DOM. */
export default function RootsFactorsActivity({ onExit, visible = true }: RootsFactorsActivityProps) {
  const surfaceActive = useSurfaceActive();
  const active = surfaceActive && visible;
  const [state, dispatch] = useReducer((previous: LearningState, action: LearningAction) => learningReducer(previous, action, active), undefined, initialLearning);
  useLayoutEffect(() => { if (!active) dispatch({ type: "suspend" }); }, [active]);
  const rootDispatch = useCallback((action: ManipulationAction) => dispatch({ type: "root", action }), []);
  const { manipulation, lesson } = state;
  const editing = manipulation.edit !== null;
  const presentation = useMemo(() => guidedPresentation(lesson, manipulation.hasChangedPlacement, editing, active), [lesson, manipulation.hasChangedPlacement, editing, active]);
  const policy = useMemo(() => learningInputPolicy(lesson, active), [lesson, active]);
  const revision = manipulation.revision;
  const onAction = useCallback((id: string) => {
    if (id === "ready" || id === "continue") dispatch({ type: id, revision });
    else if (id === "predict-minus" || id === "predict-plus") dispatch({ type: "predict", revision, choice: id === "predict-minus" ? "minus" : "plus" });
  }, [revision]);
  return visible ? <RootsFactorsView math={effectiveMath(manipulation)} presentation={presentation}
    manipulation={{ state: manipulation, policy, dispatch: rootDispatch }} onExit={onExit}
    onPromptAction={onAction} stageKey={lesson.stage} announceEligibility={lesson.stage === "orientation" && manipulation.hasChangedPlacement} /> : null;
}

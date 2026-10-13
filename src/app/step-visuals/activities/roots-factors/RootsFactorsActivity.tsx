"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef } from "react";
import RootsFactorsView from "./RootsFactorsView";
import { effectiveMath, type ManipulationAction } from "./manipulation";
import { guidedPresentation } from "./presentationLayouts";
import { learningInputPolicy } from "./learning";
import { initialRecordedLearning, recordedLearningReducer, type RecordedLearningAction, type RecordedLearningState } from "./recordedLearning";
import type { Card1LearningCallbacks } from "./learningRecords";
import { createAttemptId, useLearningNotifications } from "../../platform/web/learningNotifications";
import { useSurfaceActive } from "../../platform/web/SurfaceLifecycle";

export type RootsFactorsActivityProps = Card1LearningCallbacks & Readonly<{
  onExit?: () => void; visible?: boolean;
  /** A changed key requests a recorded restart/exit; the initial value is inert. */
  restartKey?: number; exitKey?: number;
}>;

/** Keep the state owner alive while a host hides the view; do not retain hidden solution DOM. */
export default function RootsFactorsActivity({ onExit, visible = true, restartKey = 0, exitKey = 0, onComplete, onEvent, onRecordsChange }: RootsFactorsActivityProps) {
  if (![restartKey, exitKey].every((key) => Number.isSafeInteger(key) && key >= 0)) throw new RangeError("Activity request keys must be non-negative safe integers.");
  const surfaceActive = useSurfaceActive();
  const active = surfaceActive && visible;
  const [recorded, dispatch] = useReducer((previous: RecordedLearningState, action: RecordedLearningAction) => recordedLearningReducer(previous, action, active), undefined, () => initialRecordedLearning(createAttemptId()));
  const state = recorded.learning;
  const lessonActive = active && !recorded.records.exited;
  useLayoutEffect(() => { if (!active) dispatch({ type: "lesson", action: { type: "suspend" } }); }, [active]);
  const rootDispatch = useCallback((action: ManipulationAction) => dispatch({ type: "lesson", action: { type: "root", action } }), []);
  useLearningNotifications(recorded.records, { onComplete, onEvent, onRecordsChange, onExit });
  const { manipulation, lesson } = state;
  const editing = manipulation.edit !== null;
  const presentation = useMemo(() => guidedPresentation(lesson, manipulation.hasChangedPlacement, editing, lessonActive), [lesson, manipulation.hasChangedPlacement, editing, lessonActive]);
  const policy = useMemo(() => learningInputPolicy(lesson, lessonActive), [lesson, lessonActive]);
  const revision = manipulation.revision;
  const previousRestart = useRef(restartKey);
  const previousExit = useRef(exitKey);
  useEffect(() => {
    if (previousRestart.current !== restartKey) {
      previousRestart.current = restartKey;
      dispatch({ type: "restart", revision: null, nextAttemptId: createAttemptId(), reason: "restart-request" });
    }
    if (previousExit.current !== exitKey) {
      previousExit.current = exitKey;
      dispatch({ type: "exit", revision: null });
    }
  }, [restartKey, exitKey, revision]);
  const requestExit = useCallback(() => dispatch({ type: "exit", revision }), [revision]);
  const onAction = useCallback((id: string) => {
    if (id === "start-again") dispatch({ type: "restart", revision, nextAttemptId: createAttemptId(), reason: "start-again" });
    else if (id === "ready" || id === "continue" || id === "check" || id === "explanation") dispatch({ type: "lesson", action: { type: id, revision } });
    else if (id === "predict-minus" || id === "predict-plus") dispatch({ type: "lesson", action: { type: "predict", revision, choice: id === "predict-minus" ? "minus" : "plus" } });
  }, [revision]);
  return visible ? <RootsFactorsView math={effectiveMath(manipulation)} presentation={presentation}
    manipulation={{ state: manipulation, policy, dispatch: rootDispatch }} onExit={onExit ? requestExit : undefined}
    onPromptAction={onAction} stageKey={lesson.stage} promptKey={lesson.stage === "retrieval" ? `retrieval-${lesson.panel}` : lesson.stage}
    announceEligibility={lesson.stage === "orientation" && manipulation.hasChangedPlacement} /> : null;
}

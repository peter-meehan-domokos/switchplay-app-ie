"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { HostedVisualProps } from "../../core/host";
import { acknowledgeRootsEvents, createRootsHostedState, reduceRootsHostedState, restoreRootsHostedState, rootsBackToStart, rootsHostNavigation, rootsSnapshot, type RootsHostedState } from "./hostState";
import { effectiveMath, type ManipulationAction } from "./manipulation";
import { learningInputPolicy, type LearningAction } from "./learning";
import { hostedRootsPresentation } from "./presentationLayouts";
import RootsFactorsView from "./RootsFactorsView";

export default function HostedRootsFactors({ attemptId, initialSnapshot, dimensions, onControls, onChange }: HostedVisualProps) {
  const [state, setState] = useState(() => {
    const initial = initialSnapshot === null ? createRootsHostedState(attemptId) : restoreRootsHostedState(initialSnapshot);
    if (initial.recorded.records.current.attemptId !== attemptId) throw new RangeError("Attempt snapshot identity mismatch.");
    return initial;
  });
  const current = useRef(state);
  const mounted = useRef(true);
  const persist = useCallback((next: RootsHostedState) => {
    const through = next.sequence;
    void onChange(rootsSnapshot(next), next.recorded.records.events).then(() => {
      if (!mounted.current || !current.current.recorded.records.events.some((event) => event.sequence <= through)) return;
      const acknowledged = acknowledgeRootsEvents(current.current, through);
      current.current = acknowledged; setState(acknowledged);
    }).catch(() => { /* Host reports the failed write; retain the pending events. */ });
  }, [onChange]);
  useEffect(() => {
    mounted.current = true; persist(current.current);
    return () => { mounted.current = false; };
  }, [persist]);
  const dispatch = useCallback((action: LearningAction) => {
    const previous = current.current, next = reduceRootsHostedState(previous, action);
    if (next === previous) return;
    current.current = next; setState(next);
    // No pointer samples. Accepted settled actions are queued before another UI action can close the host.
    if (next.sequence !== previous.sequence) persist(next);
  }, [persist]);
  const navigation = rootsHostNavigation(state);
  const backToStart = useCallback(() => {
    const previous = current.current, next = rootsBackToStart(previous);
    if (next === previous) return;
    current.current = next; setState(next); persist(next);
  }, [persist]);
  const revision = state.recorded.learning.manipulation.revision;
  useLayoutEffect(() => {
    const capability = rootsHostNavigation(current.current);
    onControls({ stageId: capability.stageId, atStart: capability.atStart, completed: capability.completed,
      ...(capability.completed ? { backToStart } : {}),
      ...(capability.next ? { next: { enabled: capability.next.enabled,
        run: () => dispatch({ type: capability.next!.action, revision }) } } : {}) });
  }, [onControls, dispatch, revision, navigation.stageId, navigation.next?.enabled, backToStart, state.recorded.learning.manipulation.edit]);
  const rootDispatch = useCallback((action: ManipulationAction) => dispatch({ type: "root", action }), [dispatch]);
  const { manipulation, lesson } = state.recorded.learning;
  const presentation = useMemo(() => hostedRootsPresentation(lesson, manipulation.hasChangedPlacement, !!manipulation.edit, true), [lesson, manipulation.hasChangedPlacement, manipulation.edit]);
  const policy = useMemo(() => learningInputPolicy(lesson), [lesson]);
  const onAction = (id: string) => {
    if (id === "check" || id === "explanation") dispatch({ type: id, revision });
    if (id === "predict-minus" || id === "predict-plus") dispatch({ type: "predict", revision, choice: id === "predict-minus" ? "minus" : "plus" });
  };
  // Dimensions are exposed without redesigning the existing mathematical layout.
  return <div data-visual-content-width={dimensions.width} data-visual-content-height={dimensions.height}>
    <RootsFactorsView math={effectiveMath(manipulation)} presentation={presentation}
      manipulation={{ state: manipulation, policy, dispatch: rootDispatch }} onPromptAction={onAction}
      stageKey={lesson.stage} promptKey={lesson.stage === "retrieval" ? `retrieval-${lesson.panel}` : lesson.stage}
      announceEligibility={lesson.stage === "orientation" && manipulation.hasChangedPlacement} />
  </div>;
}

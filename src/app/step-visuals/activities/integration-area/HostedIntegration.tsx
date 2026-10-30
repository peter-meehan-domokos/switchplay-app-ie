"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { HostedVisualProps } from "../../core/host";
import { acknowledgeIntegrationEvents, createIntegrationHostedState, integrationBackToStart, integrationHostNavigation, integrationSnapshot, reduceIntegrationHostedState, restoreIntegrationHostedState, type IntegrationHostedState } from "./hostState";
import type { IntegrationAction } from "./learning";
import { integrationPresentation } from "./presentation";
import { useStageMotion } from "./use-stage-motion";
import IntroStages from "./intro-stages";
import LaterStages from "./later-stages";
import styles from "./integration.module.css";

export default function HostedIntegration({ attemptId, attemptNumber = 1, initialSnapshot, dimensions, onControls, onChange }: HostedVisualProps) {
  const [hosted, setHosted] = useState(() => {
    const initial = initialSnapshot === null ? createIntegrationHostedState(attemptId, attemptNumber) : restoreIntegrationHostedState(initialSnapshot);
    if (initial.state.records.current.attemptId !== attemptId) throw new RangeError("Attempt snapshot identity mismatch.");
    return initial;
  });
  const current = useRef(hosted), mounted = useRef(true), heading = useRef<HTMLHeadingElement>(null);
  const persist = useCallback((next: IntegrationHostedState) => {
    const through = next.sequence;
    void onChange(integrationSnapshot(next), next.state.records.events).then(() => {
      if (!mounted.current || !current.current.state.records.events.some(event => event.sequence <= through)) return;
      const acknowledged = acknowledgeIntegrationEvents(current.current, through);
      current.current = acknowledged; setHosted(acknowledged);
    }).catch(() => { /* Host reports failures; pending events remain available for retry. */ });
  }, [onChange]);
  useEffect(() => { mounted.current = true; persist(current.current); return () => { mounted.current = false; }; }, [persist]);
  const dispatch = useCallback((action: IntegrationAction) => {
    const previous = current.current, next = reduceIntegrationHostedState(previous, action);
    if (next === previous) return;
    current.current = next; setHosted(next);
    // Drafts and invalid/empty Check feedback are state, not meaningful learning events.
    if (next.sequence !== previous.sequence || action.type === "draft" || action.type === "check") persist(next);
  }, [persist]);
  const state = hosted.state;
  const backToStart = useCallback(() => {
    const previous = current.current, next = integrationBackToStart(previous);
    if (next === previous) return;
    current.current = next; setHosted(next); persist(next);
  }, [persist]);
  useLayoutEffect(() => {
    const navigation = integrationHostNavigation(current.current);
    onControls({ stageId: navigation.stageId, atStart: navigation.atStart, completed: navigation.completed,
      canStartNewAttempt: navigation.atStart && !current.current.state.edit,
      ...(navigation.completed ? { backToStart } : {}),
      ...(navigation.previous ? { previous: { enabled: navigation.previous.enabled, run: () => dispatch({ type: "previous", revision: state.revision }) } } : {}),
      ...(navigation.next ? { next: { enabled: navigation.next.enabled, label: navigation.next.label, run: () => dispatch({ type: navigation.next!.action, revision: state.revision }) } } : {}) });
  }, [onControls, dispatch, state.revision, state.stage, state.part, state.edit, backToStart]);
  useStageMotion(state, true, dispatch);
  const presentation = useMemo(() => integrationPresentation(state), [state]);
  const props = { state, presentation, active: true, dispatch, headingRef: heading, hosted: true };
  return <section className={styles.activity} aria-label="Integration" data-integration-stage={state.stage} data-integration-part={state.part}
    data-visual-content-width={dimensions.width} data-visual-content-height={dimensions.height}>
    {state.stage <= 2 ? <IntroStages {...props} /> : <LaterStages {...props} />}
    <span className={styles.status} role="status" aria-live="polite" aria-atomic="true">{presentation.announcement}</span>
  </section>;
}

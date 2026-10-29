"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useReducer, useRef } from "react";
import { useSurfaceActive } from "../../platform/web/SurfaceLifecycle";
import { initialIntegration, integrationReducer } from "./learning";
import type { IntegrationCallbacks } from "./records";
import { createIntegrationAttemptId, useIntegrationNotifications } from "./notifications";
import IntroStages from "./intro-stages";
import LaterStages from "./later-stages";
import { useStageMotion } from "./use-stage-motion";
import { integrationPresentation } from "./presentation";
import styles from "./integration.module.css";

export type IntegrationActivityProps = IntegrationCallbacks & Readonly<{ visible?: boolean; onExit?: () => void; restartKey?: number; exitKey?: number }>;

export default function IntegrationActivity({ visible = true, onExit, restartKey = 0, exitKey = 0, ...callbacks }: IntegrationActivityProps) {
  if (![restartKey, exitKey].every((key) => Number.isSafeInteger(key) && key >= 0)) throw new RangeError("Activity request keys must be non-negative safe integers.");
  const active = useSurfaceActive() && visible;
  const [state, dispatch] = useReducer((previous: ReturnType<typeof initialIntegration>, action: Parameters<typeof integrationReducer>[1]) => integrationReducer(previous, action, active), undefined, () => initialIntegration(createIntegrationAttemptId()));
  useIntegrationNotifications(state.records, { ...callbacks, onExit });
  useLayoutEffect(() => { if (!active) dispatch({ type: "suspend" }); }, [active]);
  const previous = useRef({ restartKey, exitKey });
  useEffect(() => {
    // Explicit navigation wins if a host requests both operations in the same update.
    if (previous.current.exitKey !== exitKey) dispatch({ type: "exit", revision: state.revision });
    else if (previous.current.restartKey !== restartKey) dispatch({ type: "restart", revision: state.revision, attemptId: createIntegrationAttemptId() });
    previous.current = { restartKey, exitKey };
  }, [restartKey, exitKey, state.revision]);
  const presentation = useMemo(() => integrationPresentation(state), [state]);
  useStageMotion(state, active && !state.records.exited, dispatch);
  const id = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const activity = useRef<HTMLElement>(null);
  const attemptId = state.records.current.attemptId;
  const previousPanel = useRef(`${attemptId}:${state.stage}:${state.part}`);
  useEffect(() => {
    const panel = `${attemptId}:${state.stage}:${state.part}`;
    if (previousPanel.current !== panel && active) {
      // Navigation from a scrolled control group should expose the new task and graph.
      activity.current?.scrollIntoView({ block: "start", behavior: "instant" });
      heading.current?.focus({ preventScroll: true });
    }
    previousPanel.current = panel;
  }, [state.stage, state.part, attemptId, active]);
  const lessonActive = active && !state.records.exited;
  if (!visible) return null;
  return <section ref={activity} className={styles.activity} aria-label="Integration" data-integration-stage={state.stage} data-integration-part={state.part}>
    {state.stage <= 2 ? <IntroStages state={state} presentation={presentation} active={lessonActive} dispatch={dispatch} headingRef={heading} onExit={onExit} />
      : <LaterStages state={state} presentation={presentation} active={lessonActive} dispatch={dispatch} headingRef={heading} onExit={onExit} />}
    <span id={`${id}-status`} className={styles.status} role="status" aria-live="polite" aria-atomic="true">{presentation.announcement}</span>
  </section>;
}

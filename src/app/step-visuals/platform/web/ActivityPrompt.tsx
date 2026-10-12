import { memo, useEffect, useId, useRef } from "react";
import type { ActivityPromptScene } from "../../activities/roots-factors/presentationLayouts";
import styles from "./LearningUI.module.css";

/** Presentation and platform focus only; controllers supply semantic actions, never renderer arithmetic. */
export default memo(function ActivityPrompt({ scene, onAction, sizing = false, stageKey, announceEligibility = false }: { scene: ActivityPromptScene; onAction?: (id: string) => void; sizing?: boolean; stageKey?: string; announceEligibility?: boolean }) {
  const heading = useRef<HTMLHeadingElement>(null);
  const previousStage = useRef(stageKey);
  const instructionId = useId();
  useEffect(() => {
    if (stageKey !== previousStage.current) heading.current?.focus({ preventScroll: true });
    previousStage.current = stageKey;
  }, [stageKey]);
  return (
    <div className={styles.spvPrompt} data-spv-prompt={sizing ? undefined : true}>
      <h2 className={styles.spvPromptTitle} ref={heading} tabIndex={stageKey ? -1 : undefined} aria-describedby={stageKey ? instructionId : undefined}>{scene.title}</h2>
      {scene.target ? <p className={styles.spvTarget}>{scene.target}</p> : null}
      {scene.comparison.length ? <dl className={styles.spvComparison}>{scene.comparison.map((row) => (
        <div className={styles.spvComparisonRow} key={row.label}>
          <dt>{row.label}<span className={styles.spvFactorLabel}>{row.factor}</span></dt>
          <dd>{row.substitution}</dd>
        </div>
      ))}</dl> : null}
      {scene.working.length ? <div className={styles.spvWorking}>{scene.working.map((line) => <p key={line}>{line}</p>)}</div> : null}
      <p className={styles.spvInstruction} id={stageKey ? instructionId : undefined}>{scene.instruction}</p>
      {scene.feedback ? <p className={styles.spvFeedback}>{scene.feedback}</p> : null}
      {scene.actions.length ? <div className={styles.spvActions}>{scene.actions.map((action) => <button key={action.id} className={action.appearance === "primary" ? styles.spvPrimaryAction : styles.spvSecondaryAction} type="button" disabled={!action.enabled || !onAction} onClick={() => onAction?.(action.id)}>{action.label}</button>)}</div> : null}
      {stageKey ? <span className={styles.spvStatus} role="status" aria-live="polite">{announceEligibility ? "Next is now available." : ""}</span> : null}
    </div>
  );
});

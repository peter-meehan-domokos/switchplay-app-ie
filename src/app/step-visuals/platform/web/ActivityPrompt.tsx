import type { ActivityPromptScene } from "../../activities/roots-factors/presentationLayouts";
import styles from "./LearningUI.module.css";

/** Presentation only. Later controllers may supply semantic dispatch, never mathematical arithmetic. */
export default memo(function ActivityPrompt({ scene, onAction, sizing = false }: { scene: ActivityPromptScene; onAction?: (id: string) => void; sizing?: boolean }) {
  return (
    <div className={styles.spvPrompt} data-spv-prompt={sizing ? undefined : true}>
      <h2 className={styles.spvPromptTitle}>{scene.title}</h2>
      {scene.target ? <p className={styles.spvTarget}>{scene.target}</p> : null}
      {scene.comparison.length ? <dl className={styles.spvComparison}>{scene.comparison.map((row) => (
        <div className={styles.spvComparisonRow} key={row.label}>
          <dt>{row.label}<span className={styles.spvFactorLabel}>{row.factor}</span></dt>
          <dd>{row.substitution}</dd>
        </div>
      ))}</dl> : null}
      {scene.working.length ? <div className={styles.spvWorking}>{scene.working.map((line) => <p key={line}>{line}</p>)}</div> : null}
      <p className={styles.spvInstruction}>{scene.instruction}</p>
      {scene.feedback ? <p className={styles.spvFeedback}>{scene.feedback}</p> : null}
      <div className={styles.spvActions}>{scene.actions.map((action) => <button key={action.id} className={action.appearance === "primary" ? styles.spvPrimaryAction : styles.spvSecondaryAction} type="button" disabled={!action.enabled || !onAction} onClick={() => onAction?.(action.id)}>{action.label}</button>)}</div>
    </div>
  );
});
import { memo } from "react";

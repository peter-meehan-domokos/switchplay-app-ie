import type { RootAdjustmentScene } from "../../activities/roots-factors/presentationLayouts";
import styles from "./LearningUI.module.css";

export default function RootAdjustmentControls({ scene, onAction }: { scene: RootAdjustmentScene; onAction?: (id: string) => void }) {
  return (
    <div className={styles.spvAdjustments} aria-label="Root adjustment" data-spv-adjustments>
      <button className={styles.spvAdjustmentButton} type="button" aria-label={scene.actions[0].label} disabled={!scene.actions[0].enabled || !onAction} onClick={() => onAction?.(scene.actions[0].id)}><span aria-hidden="true">←</span></button>
      <p className={styles.spvReadout}><span>Root position</span><strong>{scene.positionText}</strong></p>
      <button className={styles.spvAdjustmentButton} type="button" aria-label={scene.actions[1].label} disabled={!scene.actions[1].enabled || !onAction} onClick={() => onAction?.(scene.actions[1].id)}><span aria-hidden="true">→</span></button>
    </div>
  );
}

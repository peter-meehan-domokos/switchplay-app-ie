import type { RootTaskScene } from "../../core/expressions/rootTaskLayout";
import styles from "./MathUI.module.css";

export default function RootTask({ scene }: { scene: RootTaskScene }) {
  return <div className={styles.spvRootTask} role="math" aria-label={scene.accessibleDescription} data-spv-root-task>
    <span className={styles.spvTaskFactor}><span>{scene.label}</span><span className={styles.spvMovingFactor}>{scene.factor}</span></span>
    <span>{scene.question}</span>
  </div>;
}

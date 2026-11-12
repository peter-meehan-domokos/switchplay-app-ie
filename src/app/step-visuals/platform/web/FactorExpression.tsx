import type { FactorExpressionScene } from "../../core/expressions/factorExpressionLayout";
import styles from "./MathUI.module.css";

export default function FactorExpression({ scene }: { scene: FactorExpressionScene }) {
  return (
    <p className={styles.spvExpression} role="math" aria-label={scene.accessibleDescription}>
      <span aria-hidden="true">{scene.prefix}</span>
      {scene.factors.map((factor) => <span key={factor.id} aria-hidden="true" className={factor.role === "moving-root" ? styles.spvMovingFactor : styles.spvFixedFactor}>{factor.text}</span>)}
    </p>
  );
}

import { powerRuleScenes } from "./math-presentation";
import { IndefiniteIntegral } from "./math-value";
import type { IntegrationPresentation } from "./presentation";
import styles from "./later-stages.module.css";

export default function DivisionRule({ presentation }: { presentation: IntegrationPresentation }) {
  return <div className={styles.ruleContent}>
    <div><p>For y = x:</p><IndefiniteIntegral scene={powerRuleScenes.linear} /></div>
    <div><p>For y = x²:</p><IndefiniteIntegral scene={powerRuleScenes.quadratic} /></div>
    <div><h2>The power rule for integration</h2><IndefiniteIntegral scene={powerRuleScenes.general} /><p className={styles.qualification}>n ≠ −1</p></div>
    <div>{presentation.paragraphs?.map(paragraph => <p key={paragraph}>{paragraph}</p>)}</div>
  </div>;
}

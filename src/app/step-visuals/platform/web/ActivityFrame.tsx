import type { ReactNode } from "react";
import styles from "./ActivityFrame.module.css";

type ActivityFrameProps = Readonly<{
  title: string;
  eyebrow: string;
  graph: ReactNode;
  expression: ReactNode;
  prompt: ReactNode;
  onExit?: () => void;
}>;

export default function ActivityFrame({ title, eyebrow, graph, expression, prompt, onExit }: ActivityFrameProps) {
  return (
    <section className={styles.spvFrame} aria-label={title}>
      <header className={styles.spvHeadingRow}>
        <div>
          <p className={styles.spvEyebrow}>{eyebrow}</p>
          <h1 className={styles.spvTitle} tabIndex={-1} data-spv-experience-heading>{title}</h1>
        </div>
        {onExit ? <button className={styles.spvExit} type="button" onClick={onExit}>Exit</button> : null}
      </header>
      <div className={styles.spvGraphRegion}>{graph}</div>
      <div className={styles.spvExpressionRegion}>{expression}</div>
      <div className={styles.spvPromptRegion}>{prompt}</div>
    </section>
  );
}

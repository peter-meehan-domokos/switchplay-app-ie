import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import MathsExpression from "@/components/maths-renderer/MathsExpression";
import { alignmentFixtures, presentationFixtures } from "./fixtures";
import styles from "./page.module.css";
import CapacityFixtures from "./CapacityFixtures";

export const metadata = { title: "Maths Renderer · Standalone Review" };

export default function MathsRendererDevelopmentPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  return <main className={styles.page} data-maths-stage="1">
    <header className={styles.heading}>
      <p>Standalone mathematical content renderer</p>
      <h1>Stage 1 · Alignment review</h1>
      <p>Compare two-sided working and both leading-equals candidates. All typography, spacing and indentation below are provisional.</p>
      <p>The original alignment cases are followed by mixed-content and capacity tests. Wide expressions remain intact and visible.</p>
    </header>
    {presentationFixtures.map(presentation => <section key={presentation.id} className={styles.group} data-presentation={presentation.id}>
      <h2>{presentation.title}</h2>
      {alignmentFixtures.map(fixture => <article key={fixture.id} className={styles.sample}
        data-fixture={fixture.id} data-layout={fixture.layout} data-variant={fixture.variant}>
        <h3>{fixture.title}</h3>
        <div className={styles.example} data-maths-container="" style={{
          width: presentation.width, fontSize: presentation.fontSize, fontFamily: presentation.fontFamily,
          "--maths-display-indent": "1em", "--maths-display-gap": "0.6em", "--maths-scale": "1em",
        } as CSSProperties}>
          <p data-prose-before="">Follow each line of the working.</p>
          <MathsExpression latex={fixture.latex} />
          <p data-prose-after="">Therefore, the expressions stay in their authored columns.</p>
        </div>
        <details className={styles.source}>
          <summary>View authored LaTeX source</summary>
          <pre><code>{`$$\n${fixture.latex}\n$$`}</code></pre>
        </details>
      </article>)}
    </section>)}
    <CapacityFixtures />
  </main>;
}

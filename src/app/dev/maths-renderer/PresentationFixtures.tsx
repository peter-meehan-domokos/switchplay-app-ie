"use client";

import { useRef, useState } from "react";
import MathsRenderer from "@/components/maths-renderer/MathsRenderer";
import type { MathsResult } from "@/components/maths-renderer/types";
import { recommendedPresentation, reviewContent, reviewSettings, reviewSizes } from "./presentationSamples";
import styles from "./page.module.css";

function ReviewCase({ setting, size }: { setting: typeof reviewSettings[number]; size: typeof reviewSizes[number] }) {
  const host = useRef<HTMLDivElement>(null);
  const [result, setResult] = useState<MathsResult | null>(null);
  const presentation = { ...recommendedPresentation, fontSizePx: size.fontSizePx, fontFamily: size.fontFamily, ...setting.changes };
  return <article className={styles.reviewCase} data-review-case={`${setting.id}-${size.id}`}>
    <h3>{size.label}</h3>
    <div className={styles.reviewHost} ref={host} style={{ width: `min(100%, ${size.width}px)` }} data-review-host="">
      <MathsRenderer content={reviewContent} presentation={presentation}
        constraints={{ kind: "container", elementRef: host, height: "unbounded" }} onResult={setResult} />
    </div>
    <p className={styles.reviewStatus}>{result?.status === "ready" ? `Ready: ${result.fits ? "fits" : "overflow"}` : result?.status ?? "pending"}</p>
    <details className={styles.source}><summary>Source, provisional settings and diagnostics</summary>
      <pre>{reviewContent}</pre><pre>{JSON.stringify(presentation, null, 2)}</pre>
      <pre data-review-result="">{JSON.stringify(result, null, 2)}</pre>
    </details>
  </article>;
}

export default function PresentationFixtures() {
  return <section id="presentation-review" className={styles.group} data-presentation-review="">
    <h2>Provisional presentation comparisons</h2>
    <p>Each option uses the same source and both alignment layouts. Working-row spacing retains the approved approximately 25% increase. All options include provisional 0.25em clearance above and below inline maths. Containers respond to the page width; expressions remain intact and any overflow is reported.</p>
    {reviewSettings.map(setting => <section className={styles.reviewSetting} id={setting.id} key={setting.id} data-review-setting={setting.id}>
      <h2>{setting.title}</h2><p>{setting.description}</p>
      {reviewSizes.map(size => <ReviewCase key={size.id} setting={setting} size={size} />)}
    </section>)}
  </section>;
}

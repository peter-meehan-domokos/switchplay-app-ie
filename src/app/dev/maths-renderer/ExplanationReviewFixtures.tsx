"use client";

import { useEffect, useRef, useState } from "react";
import MathsRenderer from "@/components/maths-renderer/MathsRenderer";
import type { MathsResult } from "@/components/maths-renderer/types";
import { recommendedPresentation } from "./presentationSamples";
import styles from "./explanationReview.module.css";

export const explanationReviews = [
{
  title: "Function composition",
  content: String.raw`$(g\circ f)(x)\quad\text{or}\quad g(f(x))\quad\text{means apply }f\text{ then }g$

Example
$$
f(x)=2x+1,\quad g(x)=5x
$$
$$
g(f(x))=5(2x+1)
$$`
},
  { title: "Multiplying all terms", content: String.raw`You must multiply ALL terms.

$$
\begin{alignedat}{2}
2 &= 3+\frac{1}{x} && \\
2x &= 3x+1 &\qquad& \textit{[}\times x\ \textit{all terms]}
\end{alignedat}
$$` },
  { title: "Dividing by a fraction", content: String.raw`General rule:

$$
\boldsymbol{\frac{a}{\frac{b}{c}} = \frac{ac}{b}}
$$

Special case: $a=1$ and $b=1$

$$
\frac{1}{\frac{1}{c}} = c
$$` },
  { title: "Negative fractions", content: String.raw`General rule:

$$
\boldsymbol{\frac{a}{-b} = \frac{-a}{b} = -\left(\frac{a}{b}\right)}
$$

Special case: $a=1$ and $b=1$

$$
\frac{1}{-1} = \frac{-1}{1} = -1
$$` },
  { title: "Subtracting brackets", content: String.raw`$$
a-(b-c)=a-b+c
$$` },
] as const;

function ExplanationBox({ index, scale }: { index: number; scale: number }) {
  const sample = explanationReviews[index];
  const budget = useRef<HTMLDivElement>(null);
  const [result, setResult] = useState<MathsResult | null>(null);
  return <article className={styles.sample} data-explanation-review={index + 1}>
    <h3>{index + 1}. {sample.title}</h3>
    <div style={{ width: 240 * scale, height: 204 * scale }}>
      <div className={styles.frame} data-explanation-frame="" style={{ transform: `scale(${scale})` }}>
        {/* Reserve the real header line box without putting review labels in the body. */}
        <h3 className={styles.header} aria-hidden="true"><span><button tabIndex={-1} className={styles.series}>Series</button></span>{" · "}<span className={styles.title}>Title</span></h3>
        <div className={styles.viewport} data-explanation-viewport="" tabIndex={0} role="region" aria-label={`${sample.title} explanation, scrollable`}>
          <div className={styles.budget} ref={budget} data-explanation-budget="">
            <MathsRenderer content={sample.content}
              presentation={{ ...recommendedPresentation, fontFamily: "Arial, Helvetica, sans-serif", fontSizePx: 9.5, lineHeight: 1.25 }}
              constraints={{ kind: "container", elementRef: budget, height: "bounded" }} onResult={setResult} />
          </div>
        </div>
      </div>
    </div>
    <p className={styles.status} data-explanation-status="" aria-live="polite">{result?.status === "ready"
      ? `${result.fits ? "Fits" : "Overflow"} · vertical: ${result.layout.overflowY ? "yes" : "no"} · horizontal: ${result.layout.overflowX ? "yes" : "no"} · available: ${result.layout.available.width.toFixed(3)} × ${result.layout.available.height?.toFixed(3)}px`
      : result?.status ?? "pending"}</p>
    <details><summary>Authored source and measurement</summary><pre>{sample.content}</pre><pre data-explanation-result="">{JSON.stringify(result, null, 2)}</pre></details>
  </article>;
}

export default function ExplanationReviewFixtures() {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    // Review-only mirror of FocusedCardView.getFocusedCardScale and cardStack
    // constants. Preserve the real consumer's whole-card viewport scaling,
    // independently of the renderer's natural layout and capacity contract.
    const update = () => {
      const width = Math.max(0, (window.visualViewport?.width ?? window.innerWidth) - 18);
      const heightWidth = Math.max(0, (window.visualViewport?.height ?? window.innerHeight) - 18) / 1.45;
      setScale(Math.max(Math.min(284, width, heightWidth), Math.min(394, 430, width, heightWidth)) / 252);
    };
    update();
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    return () => {
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
    };
  }, []);
  return <section id="five-explanations" className={styles.section} data-five-explanations="">
    <h2>Five explanations · exact Info Card explanation space</h2>
    <p>Text-only cards, without a media row: 240 × 204px outer frame, 1px border, 12px padding and the real header reservation, in local CSS pixels. The whole frame follows the real card’s viewport scaling. Each inner explanation viewport has no padding or border. Card prose typography (9.5px Arial, line height 1.25) with approved Balanced maths styling. Scroll each explanation independently; measurements describe the complete content before the whole-card transform.</p>
    {explanationReviews.map((sample, index) => <ExplanationBox index={index} scale={scale} key={sample.title} />)}
  </section>;
}

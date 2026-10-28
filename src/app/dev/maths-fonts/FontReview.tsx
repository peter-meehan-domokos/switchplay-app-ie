"use client";

import { useRef, useState, type CSSProperties } from "react";
import MathsRenderer from "@/components/maths-renderer/MathsRenderer";
import type { MathsResult } from "@/components/maths-renderer/types";
import { explanationReviews } from "../maths-renderer/ExplanationReviewFixtures";
import styles from "./review.module.css";

export const fontProfiles = [
  { id: "current", name: "Current reference", prose: "Arial, Helvetica, sans-serif", serif: '"Times New Roman"', note: "System Arial and Times New Roman on this device. No proprietary fonts are supplied by this page." },
  { id: "liberation", name: "Liberation Sans + Liberation Serif", prose: '"ReviewLiberationSans", sans-serif', serif: '"ReviewLiberationSerif"', note: "Static open fonts, version 2.1.5. Candidate only; no production typography change." },
  { id: "arimo", name: "Arimo + Tinos", prose: '"ReviewArimo", sans-serif', serif: '"ReviewTinos"', note: "Pinned open-font revisions. Arimo uses its supplied variable weight font. Candidate only." },
] as const;

const balanced = { fontSizePx: 9.5, fontWeight: 400, lineHeight: 1.25, mathScale: 1, displayIndentEm: 1, displayGapEm: .6, paragraphGapEm: .8 };
const currency = String.raw`Prose: €12, £8 and \$5.
Inline: $x=\frac{1}{2}$ and $y=\sqrt{x^2+1}$.
Maths: $\$5+\pounds 8$.
Euro: $\text{€}$, $\textbf{€}$, $\textit{€}$, $\textbf{\textit{€}}$.
Therefore, continue with the same mathematical working.`;
const tall = Array(3).fill(explanationReviews[2].content).join("\n\n");

function Status({ result }: { result: MathsResult | null }) {
  return <details className={styles.diagnostics}><summary>{result?.status === "ready"
    ? `${result.fits ? "Fits" : "Overflow"} · x: ${result.layout.overflowX ? "yes" : "no"} · y: ${result.layout.overflowY ? "yes" : "no"} · required ${result.layout.width.toFixed(2)} × ${result.layout.height.toFixed(2)}px`
    : result?.status ?? "pending"}</summary><pre data-font-result="">{JSON.stringify(result, null, 2)}</pre></details>;
}

function Example({ profile, index }: { profile: typeof fontProfiles[number]; index: number }) {
  const host = useRef<HTMLDivElement>(null);
  const [result, setResult] = useState<MathsResult | null>(null);
  const example = explanationReviews[index];
  return <article className={styles.example} data-font-example={index + 1}>
    <h3>{index + 1}. {example.title}</h3>
    <div className={styles.frame} style={{ fontFamily: profile.prose }} data-font-frame="">
      <h4 className={styles.header} aria-hidden="true"><button tabIndex={-1}>Series</button>{" · "}<b>Title</b></h4>
      <div className={styles.viewport} tabIndex={0} role="region" aria-label={`${profile.name}, ${example.title}`}>
        <div ref={host} className={styles.budget} data-font-budget="">
          <MathsRenderer content={example.content} presentation={{ ...balanced, fontFamily: profile.prose }}
            constraints={{ kind: "container", elementRef: host, height: "bounded" }} onResult={setResult} />
        </div>
      </div>
    </div>
    <Status result={result} />
    <details className={styles.source}><summary>Unchanged source</summary><pre data-font-source="">{example.content}</pre></details>
  </article>;
}

function Panel({ profile, height, content, label, size = 9.5 }: { profile: typeof fontProfiles[number]; height: number | null; content: string; label: string; size?: number }) {
  const [result, setResult] = useState<MathsResult | null>(null);
  return <article className={styles.example} data-font-panel={height ?? "reading"}>
    <h3>{label}</h3>
    <div className={styles.panel} style={{ height: height ?? undefined, width: size === 9.5 ? 214 : "100%" }}>
      <MathsRenderer content={content} presentation={{ ...balanced, fontSizePx: size, fontFamily: profile.prose }}
        constraints={{ kind: "explicit", widthPx: size === 9.5 ? 214 : 260, heightPx: height }} onResult={setResult} />
    </div>
    <Status result={result} />
  </article>;
}

export default function FontReview() {
  return <main className={styles.page} data-font-review="">
    <h1>Open fonts · visual comparison</h1>
    <p>Review candidates only. KaTeX mathematical fonts and all approved Balanced spacing remain unchanged. The prose font and missing-glyph serif fallback vary. No production Info Card changes.</p>
    <nav>{fontProfiles.map(profile => <a key={profile.id} href={`#${profile.id}`}>{profile.name}</a>)}</nav>
    <p>The five sources are imported directly from the existing review fixtures. Reference frames retain the current 240 × 157px outer geometry; this is a comparison size, not a permanent card limit. Scroll each example independently if needed. Separate tall samples use larger content-height constraints.</p>
    <div className={styles.profiles}>{fontProfiles.map(profile => <section id={profile.id} key={profile.id} className={styles.profile}
      data-font-profile={profile.id} style={{ "--review-serif": profile.serif } as CSSProperties}>
      <h2>{profile.name}</h2><p>{profile.note}</p>
      {explanationReviews.map((example, index) => <Example profile={profile} index={index} key={example.title} />)}
      <Panel profile={profile} height={null} size={18} content={currency} label="Larger reading sample · 18px prose" />
      <Panel profile={profile} height={160} content={tall} label="Tall content · 160px budget" />
      <Panel profile={profile} height={320} content={tall} label="Same content · 320px budget" />
    </section>)}</div>
    <p>The current column uses fonts available on your device, so its reference appearance can vary by operating system. Candidate fonts are bundled locally under SIL OFL 1.1 with their notices retained. Euro metric warnings remain visible in diagnostics; no source repair is performed.</p>
  </main>;
}

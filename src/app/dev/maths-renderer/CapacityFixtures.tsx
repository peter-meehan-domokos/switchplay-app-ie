"use client";

import { useEffect, useRef, useState } from "react";
import MathsRenderer from "@/components/maths-renderer/MathsRenderer";
import type { MathsPresentation, MathsResult } from "@/components/maths-renderer/types";
import styles from "./page.module.css";

type FixtureState = { content: string; width: number; height: number | null; mode: "explicit" | "container"; presentation: MathsPresentation; hidden?: boolean; transform?: string; mounted?: boolean };
type FixtureControls = { update: (patch: Partial<FixtureState>) => void; history: { content: string; result: MathsResult }[] };
declare global { interface Window { mathsFixtures?: Record<string, FixtureControls> } }
const typography: MathsPresentation = { fontFamily: "Arial, sans-serif", fontSizePx: 18, lineHeight: 1.5, mathScale: 1, paragraphGapEm: 0.8, displayIndentEm: 1, displayGapEm: 0.6 };
const working = String.raw`To solve, divide both sides by 3.

$$\begin{aligned}3x&=12\\x&=\frac{12}{3}\end{aligned}$$

Therefore,
$$x=4$$`;
const fixtures: (Partial<FixtureState> & { id: string; title: string; content: string })[] = [
  { id: "mixed", title: "Mixed prose and working", content: working, width: 360, height: 330 },
  { id: "container", title: "Container content box (same budget)", content: working, width: 360, height: 330, mode: "container" },
  { id: "inline", title: "Atomic inline mathematics in wrapping prose", content: String.raw`Ordinary prose wraps around $\frac{x^2+1}{\sqrt{y+2}}$ as one intact expression, followed by a deliberately authored line.
Therefore, $x=4$.`, width: 260, height: 250 },
  { id: "wide", title: "Insufficient width", content: String.raw`A long intact expression:
$a+b+c+d+e+f+g+h+i+j+k+l+m+n+o+p=q$`, width: 160, height: 300 },
  { id: "tall", title: "Insufficient height", content: working, width: 420, height: 35 },
  { id: "nested", title: "Nested fractions, radicals and powers", content: String.raw`Nested expressions:
$$\frac{1+\sqrt{\frac{x^2+1}{y+2}}}{\frac{a^3+b}{c^2}}=\sqrt[3]{z^4+1}$$
Therefore, the authored mathematics remains unchanged.`, width: 650, height: 400, presentation: { ...typography, fontFamily: "Georgia, serif", fontSizePx: 23 } },
  { id: "unbounded", title: "Container with explicitly unbounded height", content: working, mode: "container", width: 280, height: null },
  { id: "currency", title: "Currency and authored prose breaks", content: String.raw`A literal dollar costs \$5, €6 or £7.
No Markdown: **ordinary text**.


Mathematical currency: $\$5+\pounds 7+\text{€}6$.`, width: 500, height: 250 },
  { id: "invalid", title: "Invalid mathematics retains its delimiters", content: String.raw`Earlier $x=2$ remains readable.
$$\frac{1}$$
Therefore, correct the source.`, width: 350, height: 220 },
  { id: "unmatched", title: "Unmatched opener: literal remainder", content: "Before $x=1$.\n$$unclosed\nLater $x=3$ stays literal.", width: 350, height: 220 },
  { id: "overhang", title: "Descendants beyond ordinary math boxes", content: String.raw`$$\smash{\frac{\frac{a}{b}}{\frac{c}{d}}}+\llap{abcdefghij}x$$`, width: 240, height: 40 },
];

function CapacityCase({ fixture }: { fixture: typeof fixtures[number] }) {
  const [state, setState] = useState<FixtureState>({ width: 360, height: 300, mode: "explicit", presentation: typography, mounted: true, ...fixture });
  const [result, setResult] = useState<MathsResult | null>(null);
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);
  const host = useRef<HTMLDivElement>(null);
  const history = useRef<FixtureControls["history"]>([]);
  useEffect(() => {
    window.mathsFixtures ??= {};
    window.mathsFixtures[fixture.id] = { update: patch => setState(value => ({ ...value, ...patch })), history: history.current };
    return () => { delete window.mathsFixtures?.[fixture.id]; };
  }, [fixture.id]);
  const naturalHeight = measuredHeight ?? 450;
  return <article className={styles.capacityCase} data-capacity-case={fixture.id}>
    <h3>{fixture.title}</h3>
    <div style={{ paddingBottom: Math.max(0, naturalHeight - (state.height ?? naturalHeight)) + 24 }}>
      <div ref={host} data-capacity-host="" style={{ width: state.width, height: state.height ?? "auto", padding: 12, border: "1px solid #9ea9b1", boxSizing: "content-box", background: "white", display: state.hidden ? "none" : "block", transform: state.transform }}>
        {state.mounted && <MathsRenderer content={state.content} presentation={state.presentation}
          constraints={state.mode === "explicit" ? { kind: "explicit", widthPx: state.width, heightPx: state.height } : { kind: "container", elementRef: host, height: state.height === null ? "unbounded" : "bounded" }}
          onResult={next => { history.current.push({ content: state.content, result: next }); setResult(next); if (next.status === "ready") setMeasuredHeight(next.layout.height); }} />}
      </div>
    </div>
    <p>{result?.status === "ready" ? `Ready: ${result.fits ? "fits" : "overflow"}` : result?.status ?? "pending"}</p>
    <details className={styles.source}><summary>Source and current layout diagnostics</summary>
      <pre data-capacity-source="">{state.content}</pre>
      <pre className={styles.diagnostics} data-capacity-result="">{JSON.stringify(result, null, 2)}</pre>
    </details>
  </article>;
}

export default function CapacityFixtures() {
  return <section className={styles.group} data-capacity-fixtures="">
    <h2>Stages 2–3 · Mixed content and actual capacity</h2>
    <p>Fixed testing scenarios using the approved Balanced base styling and representative typography. Overflow remains visible; measurements and source are outside each content host.</p>
    {fixtures.map(fixture => <CapacityCase key={fixture.id} fixture={fixture} />)}
  </section>;
}

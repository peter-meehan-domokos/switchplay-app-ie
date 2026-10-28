"use client";

import { StrictMode, useCallback, useEffect, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import MathsRenderer from "@/components/maths-renderer/MathsRenderer";
import type { MathsPresentation, MathsResult } from "@/components/maths-renderer/types";
import { recommendedPresentation } from "./presentationSamples";
import styles from "./page.module.css";

type State = { mounted: boolean; content: string; presentation: MathsPresentation; revision: number };
type History = { content: string; result: MathsResult }[];
declare global { interface Window { mathsLifecycle?: { update: (patch: Partial<State>) => void; useHost: (host: "inner" | "outer") => void; history: History } } }

// Fixed fixture with test-only controls. No public renderer refresh/test API.
export default function LifecycleFixture() {
  const [state, setState] = useState<State>({ mounted: true, content: "Before $x=1$.\n$$x=\\frac{12}{3}$$\nTherefore, $x=4$.", presentation: recommendedPresentation, revision: 0 });
  const [result, setResult] = useState<MathsResult | null>(null);
  const outer = useRef<HTMLDivElement>(null), inner = useRef<HTMLDivElement>(null), target = useRef<HTMLDivElement>(null);
  const mountPoint = useRef<HTMLDivElement>(null), rendererRoot = useRef<Root | null>(null);
  const history = useRef<History>([]);
  const latest = useRef(state);
  const assignInner = useCallback((element: HTMLDivElement | null) => {
    inner.current = element;
    if (!target.current || !element) target.current = element;
  }, []);
  const renderState = useCallback((value: State) => {
    const root = rendererRoot.current;
    if (!root) return;
    root.render(<StrictMode>{value.mounted && <MathsRenderer content={value.content} presentation={value.presentation}
      constraints={{ kind: "container", elementRef: target, height: "bounded" }} onResult={next => {
        if (rendererRoot.current !== root) return;
        history.current.push({ content: value.content, result: next }); setResult(next);
      }} />}</StrictMode>);
  }, []);
  // A full development root verifies effect replay. Defer ownership changes so
  // parent remounts/Fast Refresh never unmount a root during another commit.
  useEffect(() => {
    let cancelled = false, owned: Root | null = null;
    queueMicrotask(() => {
      if (cancelled) return;
      owned = createRoot(mountPoint.current!); rendererRoot.current = owned;
      renderState(latest.current);
    });
    return () => {
      cancelled = true;
      if (rendererRoot.current === owned) rendererRoot.current = null;
      queueMicrotask(() => owned?.unmount());
    };
  }, [renderState]);
  useEffect(() => { latest.current = state; renderState(state); }, [state, renderState]);
  useEffect(() => {
    window.mathsLifecycle = {
      update: patch => setState(value => ({ ...value, ...patch })),
      useHost: host => { target.current = host === "inner" ? inner.current : outer.current; setState(value => ({ ...value, revision: value.revision + 1 })); },
      history: history.current,
    };
    return () => { delete window.mathsLifecycle; };
  }, []);
  return <article className={styles.capacityCase} data-lifecycle-fixture="">
    <h3>Lifecycle fixture · strict development mounting</h3>
    <div ref={outer} style={{ width: 320, height: 300 }} data-lifecycle-outer="">
      <div ref={assignInner} style={{ width: 320, height: 50 }} data-lifecycle-inner="">
        <div ref={mountPoint} />
      </div>
    </div>
    <details className={styles.source}><summary>Lifecycle fixture diagnostics</summary><pre data-lifecycle-result="">{JSON.stringify(result, null, 2)}</pre></details>
  </article>;
}

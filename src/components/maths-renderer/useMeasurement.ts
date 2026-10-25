"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { ensureFonts } from "./fontReadiness";
import { measureLayout, MeasurementError } from "./measureLayout";
import type { MathsConstraints, MathsDiagnostic, MathsResult } from "./types";

export function useMeasurement(rootRef: RefObject<HTMLDivElement | null>, constraints: MathsConstraints, inputKey: object, diagnostics: MathsDiagnostic[], invalid: boolean, configurationError: boolean, onResult?: (result: MathsResult) => void) {
  const generation = useRef(0);
  const [state, setState] = useState<{ key: object; result: MathsResult } | null>(null);
  const callback = useRef(onResult);
  useLayoutEffect(() => { callback.current = onResult; });

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let cancelled = false, scheduled = 0;
    const abort = new AbortController();
    let fonts: Promise<void> | null = null, waitingFonts = false;
    const frames = new Map<number, () => void>();
    function frame() { return new Promise<void>(resolve => { const id = requestAnimationFrame(() => { frames.delete(id); resolve(); }); frames.set(id, resolve); }); }
    function publish(result: MathsResult) { if (!cancelled) setState({ key: inputKey, result }); }
    async function read(current: number) {
      const live = () => !cancelled && current === generation.current;
      try {
        if (configurationError) throw new MeasurementError("INVALID_PRESENTATION", "Presentation values must be finite, with positive type sizes and nonnegative spacing.");
        // Resolve visibility/configuration before waiting on fonts. Hidden
        // content must not inherit an older successful measurement.
        measureLayout(root!, constraints);
        if (invalid) { publish({ status: "invalid-input", generation: current, diagnostics }); return; }
        if (!fonts) {
          waitingFonts = true;
          fonts = ensureFonts(root!, abort.signal).finally(() => { waitingFonts = false; });
        }
        await fonts;
        if (!live()) return;
        let previous = "";
        for (let attempts = 0; attempts < 8; attempts++) {
          await frame(); if (!live()) return;
          const layout = measureLayout(root!, constraints);
          const style = getComputedStyle(root!);
          const signature = JSON.stringify([layout, style.font, style.lineHeight]);
          if (signature === previous) {
            publish({ status: "ready", fits: !layout.overflowX && !layout.overflowY, layout, generation: current, diagnostics });
            return;
          }
          previous = signature;
        }
        throw new MeasurementError("UNSTABLE_LAYOUT", "Layout did not stabilise across consecutive animation frames.");
      } catch (error) {
        if (!live()) return;
        const issue = error instanceof MeasurementError ? error : new MeasurementError("MEASUREMENT_FAILED", error instanceof Error ? error.message : "Measurement failed.");
        const allDiagnostics: MathsDiagnostic[] = [...diagnostics, { code: issue.code, severity: "error", message: issue.message }];
        publish(invalid ? { status: "invalid-input", generation: current, diagnostics: allDiagnostics } : { status: "measurement-unavailable", reason: issue.code, generation: current, diagnostics: allDiagnostics });
      }
    }
    function invalidate() {
      const current = ++generation.current;
      if (scheduled) cancelAnimationFrame(scheduled);
      publish({ status: invalid ? "invalid-input" : "pending", generation: current, diagnostics });
      scheduled = requestAnimationFrame(() => { scheduled = 0; void read(current); });
    }
    const observer = new ResizeObserver(invalidate);
    observer.observe(root);
    const host = constraints.kind === "container" ? constraints.elementRef.current : root.parentElement;
    if (host && host !== root) observer.observe(host);
    // Transforms and visibility changes do not necessarily resize a box. Watch
    // this instance's ancestor chain only, not application-wide mutations.
    const ancestors: HTMLElement[] = [];
    for (let ancestor: HTMLElement | null = root; ancestor; ancestor = ancestor.parentElement) {
      ancestors.push(ancestor);
    }
    function environment() { return JSON.stringify(ancestors.map(element => { const s = getComputedStyle(element); return [s.display, s.visibility, s.contentVisibility, s.transform, s.scale, s.rotate, s.perspective, s.zoom, s.font, s.lineHeight, s.letterSpacing, s.wordSpacing, s.direction, s.writingMode, s.textTransform]; })); }
    let previousEnvironment = environment();
    function environmentChanged() {
      const next = environment();
      if (next !== previousEnvironment) { previousEnvironment = next; fonts = null; invalidate(); }
    }
    const attributes = new MutationObserver(environmentChanged);
    for (const ancestor of ancestors) attributes.observe(ancestor, { attributes: true, attributeFilter: ["style", "class", "hidden"] });
    const animationEvents = ["transitionrun", "transitionend", "transitioncancel", "animationstart", "animationend", "animationcancel"];
    function animationEvent(event: Event) { if (event.target === event.currentTarget) invalidate(); }
    for (const ancestor of ancestors) for (const event of animationEvents) ancestor.addEventListener(event, animationEvent);
    function fontEvent() { if (!waitingFonts) { fonts = null; invalidate(); } }
    document.fonts?.addEventListener("loading", fontEvent);
    document.fonts?.addEventListener("loadingdone", fontEvent);
    document.fonts?.addEventListener("loadingerror", fontEvent);
    window.addEventListener("resize", environmentChanged);
    invalidate();
    return () => {
      cancelled = true; abort.abort(); observer.disconnect(); attributes.disconnect();
      for (const ancestor of ancestors) for (const event of animationEvents) ancestor.removeEventListener(event, animationEvent);
      cancelAnimationFrame(scheduled);
      for (const [id, resolve] of frames) { cancelAnimationFrame(id); resolve(); }
      frames.clear();
      document.fonts?.removeEventListener("loading", fontEvent);
      document.fonts?.removeEventListener("loadingdone", fontEvent);
      document.fonts?.removeEventListener("loadingerror", fontEvent);
      window.removeEventListener("resize", environmentChanged);
    };
  }, [rootRef, constraints, inputKey, diagnostics, invalid, configurationError]);

  // A prop change is pending immediately; an old ready result is never exposed
  // during the render before observers/effects can invalidate their work.
  const result = useMemo<MathsResult>(() => state?.key === inputKey ? state.result : { status: invalid ? "invalid-input" : "pending", generation: (state?.result.generation ?? -1) + 1, diagnostics }, [state, inputKey, invalid, diagnostics]);
  useEffect(() => { callback.current?.(result); }, [result]);
  return result;
}

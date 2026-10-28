"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { ensureFonts, fontChangeAffects } from "./fontReadiness";
import { measureLayout, MeasurementError } from "./measureLayout";
import type { MathsConstraints, MathsDiagnostic, MathsResult } from "./types";

export function useMeasurement(rootRef: RefObject<HTMLDivElement | null>, constraints: MathsConstraints, inputKey: object, diagnostics: MathsDiagnostic[], invalid: boolean, configurationError: boolean, onResult?: (result: MathsResult) => void) {
  const generation = useRef(0);
  const [state, setState] = useState<{ key: object; result: MathsResult } | null>(null);
  const callback = useRef(onResult);
  const refresh = useRef<(() => void) | null>(null);
  const notified = useRef<{ key: object; signature: string } | null>(null);
  useLayoutEffect(() => { callback.current = onResult; });

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let cancelled = false, scheduled = 0;
    let fonts: { promise: Promise<void>; abort: AbortController; waiting: boolean } | null = null;
    const frames = new Map<number, () => void>();
    function frame() { return new Promise<void>(resolve => { const id = requestAnimationFrame(() => { frames.delete(id); resolve(); }); frames.set(id, resolve); }); }
    function publish(result: MathsResult) {
      if (cancelled) return;
      setState(previous => previous?.key === inputKey && JSON.stringify(previous.result) === JSON.stringify(result) ? previous : { key: inputKey, result });
    }
    function forgetFonts() { fonts?.abort.abort(); fonts = null; }
    async function read(current: number) {
      const live = () => !cancelled && current === generation.current;
      try {
        if (configurationError) throw new MeasurementError("INVALID_PRESENTATION", "Presentation values must be finite, with positive type sizes and nonnegative spacing.");
        measureLayout(root!, constraints);
        if (invalid) { publish({ status: "invalid-input", generation: current, diagnostics }); return; }
        if (!fonts) {
          const check = { abort: new AbortController(), waiting: true, promise: Promise.resolve() };
          check.promise = ensureFonts(root!, check.abort.signal).finally(() => { check.waiting = false; });
          fonts = check;
        }
        await fonts.promise;
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
      cancelAnimationFrame(scheduled);
      publish({ status: invalid ? "invalid-input" : "pending", generation: current, diagnostics });
      scheduled = requestAnimationFrame(() => { scheduled = 0; void read(current); });
    }
    if (typeof ResizeObserver !== "function") {
      publish({ status: "measurement-unavailable", reason: "RESIZE_OBSERVER_UNAVAILABLE", generation: ++generation.current,
        diagnostics: [...diagnostics, { code: "RESIZE_OBSERVER_UNAVAILABLE", severity: "error", message: "This browser cannot observe layout changes reliably." }] });
      return;
    }

    let ancestors: HTMLElement[] = [], host: HTMLElement | null = null, connected = root.isConnected, previousEnvironment = "";
    const sizes = new Map<Element, string>();
    const animationEvents = ["transitionrun", "transitionend", "transitioncancel", "animationstart", "animationend", "animationcancel"];
    function animationEvent(event: Event) { if (event.target === event.currentTarget) invalidate(); }
    const observer = new ResizeObserver(entries => {
      let changed = syncEnvironment();
      for (const entry of entries) {
        const size = `${entry.contentRect.width},${entry.contentRect.height}`;
        if (sizes.has(entry.target) && sizes.get(entry.target) !== size) changed = true;
        sizes.set(entry.target, size);
      }
      // Initial reads already await two frames. The first delivery establishes
      // a baseline; identical deliveries must not cause measurement loops.
      if (changed) invalidate();
    });
    const attributes = new MutationObserver(() => { if (syncEnvironment()) invalidate(); });
    function environment() {
      return JSON.stringify(ancestors.map(element => {
        const s = getComputedStyle(element);
        return [element.getAttribute("open"), s.display, s.visibility, s.contentVisibility, s.transform, s.scale, s.rotate, s.perspective, s.zoom, s.font, s.lineHeight, s.letterSpacing, s.wordSpacing, s.direction, s.writingMode, s.textTransform];
      }));
    }
    function syncEnvironment() {
      const nextAncestors: HTMLElement[] = [];
      for (let element: HTMLElement | null = root!; element; element = element.parentElement) nextAncestors.push(element);
      const nextHost = constraints.kind === "container" ? constraints.elementRef.current : root!.parentElement;
      const moved = nextHost !== host || connected !== root!.isConnected || ancestors.length !== nextAncestors.length || ancestors.some((element, i) => element !== nextAncestors[i]);
      if (moved) {
        observer.disconnect(); attributes.disconnect(); sizes.clear();
        for (const ancestor of ancestors) for (const event of animationEvents) ancestor.removeEventListener(event, animationEvent);
        ancestors = nextAncestors; host = nextHost; connected = root!.isConnected;
        observer.observe(root!);
        if (host && host !== root) observer.observe(host);
        for (const ancestor of ancestors) {
          // Observe direct ancestor changes, never an application-wide subtree.
          attributes.observe(ancestor, { attributes: true, childList: true, attributeFilter: ["style", "class", "hidden", "open"] });
          for (const event of animationEvents) ancestor.addEventListener(event, animationEvent);
        }
      }
      const next = environment();
      if (moved || next !== previousEnvironment) { previousEnvironment = next; forgetFonts(); return true; }
      return false;
    }
    function refreshEnvironment() { if (syncEnvironment()) invalidate(); }
    function fontEvent(event: Event) {
      if (!fonts?.waiting && fontChangeAffects(root!, event)) { forgetFonts(); invalidate(); }
    }
    syncEnvironment();
    // A React commit can replace a stable ref's target without a DOM mutation.
    // Check identities here, not animated computed styles: reading a different
    // transform matrix on each state commit could itself trigger another commit.
    refresh.current = () => {
      const nextHost = constraints.kind === "container" ? constraints.elementRef.current : root.parentElement;
      if (nextHost !== host || root.isConnected !== connected || root.parentElement !== ancestors[1]) refreshEnvironment();
    };
    document.fonts?.addEventListener("loading", fontEvent);
    document.fonts?.addEventListener("loadingdone", fontEvent);
    document.fonts?.addEventListener("loadingerror", fontEvent);
    window.addEventListener("resize", refreshEnvironment);
    invalidate();
    return () => {
      cancelled = true; refresh.current = null; forgetFonts(); observer.disconnect(); attributes.disconnect();
      for (const ancestor of ancestors) for (const event of animationEvents) ancestor.removeEventListener(event, animationEvent);
      cancelAnimationFrame(scheduled);
      for (const [id, resolve] of frames) { cancelAnimationFrame(id); resolve(); }
      frames.clear();
      document.fonts?.removeEventListener("loading", fontEvent);
      document.fonts?.removeEventListener("loadingdone", fontEvent);
      document.fonts?.removeEventListener("loadingerror", fontEvent);
      window.removeEventListener("resize", refreshEnvironment);
    };
  }, [rootRef, constraints, inputKey, diagnostics, invalid, configurationError]);

  // A stable RefObject can point at a replacement host after a React commit.
  useLayoutEffect(() => { refresh.current?.(); });
  const result = useMemo<MathsResult>(() => state?.key === inputKey ? state.result : { status: invalid ? "invalid-input" : "pending", generation: (state?.result.generation ?? -1) + 1, diagnostics }, [state, inputKey, invalid, diagnostics]);
  useEffect(() => {
    if (!callback.current) return;
    // Generations guard asynchronous reads. Notify a consumer once per semantic
    // state, rather than once per coalesced pending generation.
    const signature = JSON.stringify({ ...result, generation: undefined });
    if (notified.current?.key === inputKey && notified.current.signature === signature) return;
    notified.current = { key: inputKey, signature };
    callback.current(result);
  });
  return result;
}

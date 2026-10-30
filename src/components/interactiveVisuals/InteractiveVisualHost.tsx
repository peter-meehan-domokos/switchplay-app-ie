"use client";

import { Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState, type ComponentType } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "motion/react";
import type { HostedVisualProps, VisualHostControls } from "@/app/step-visuals/core/host";
import type { OpenVisual, VisualPersistence } from "@/lib/interactiveVisuals/persistence";
import { buildInteractiveVisualHostLayout } from "./interactiveVisualHostLayout";
import styles from "./InteractiveVisualHost.module.css";

export default function InteractiveVisualHost({ title, opened, persistence, Visual, onClose, returnFocus }: {
  title: string; opened: OpenVisual; persistence: VisualPersistence; Visual: ComponentType<HostedVisualProps>;
  onClose: () => void; returnFocus: HTMLElement;
}) {
  const dialog = useRef<HTMLDialogElement>(null), content = useRef<HTMLDivElement>(null), close = useRef<HTMLButtonElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [controls, setControls] = useState<VisualHostControls | null>(null);
  const [status, setStatus] = useState(persistence.statusLabel);
  const [active, setActive] = useState(opened), [creating, setCreating] = useState(false);
  const creatingRef = useRef(false);
  const reduced = useReducedMotion();
  useEffect(() => persistence.subscribe?.(active.attemptId, setStatus), [persistence, active.attemptId]);
  const closeHost = useCallback(() => { void persistence.flush?.(active.attemptId); onClose(); }, [persistence, active.attemptId, onClose]);
  useLayoutEffect(() => {
    const element = dialog.current!;
    element.showModal(); close.current?.focus({ preventScroll: true });
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { element.close(); document.body.style.overflow = previousOverflow; if (returnFocus.isConnected) returnFocus.focus({ preventScroll: true }); };
  }, [returnFocus]);
  useLayoutEffect(() => {
    const measure = () => {
      const rect = content.current!.getBoundingClientRect();
      setDimensions((previous) => previous.width === rect.width && previous.height === rect.height ? previous : { width: rect.width, height: rect.height });
    };
    const observer = new ResizeObserver(measure); observer.observe(content.current!); measure();
    window.visualViewport?.addEventListener("resize", measure);
    return () => { observer.disconnect(); window.visualViewport?.removeEventListener("resize", measure); };
  }, []);
  const onChange = useCallback<HostedVisualProps["onChange"]>(async (snapshot, events) => {
    try { await persistence.save(active, snapshot, events); if (!persistence.subscribe) setStatus(persistence.statusLabel); }
    catch (error) { setStatus("Changes are pending. Saving failed."); throw error; }
  }, [active, persistence]);
  const startNewAttempt = useCallback(async () => {
    if (creatingRef.current || !controls?.atStart || controls.canStartNewAttempt === false || !persistence.startNewAttempt) return;
    if (!window.confirm("Start a new attempt? Your current attempt and its history will be kept.")) return;
    creatingRef.current = true; setCreating(true);
    try { const next = await persistence.startNewAttempt(active); setControls(null); setStatus(persistence.statusLabel); setActive(next); close.current?.focus({ preventScroll: true }); }
    catch { setStatus("Unable to start a new attempt. Your current work is kept."); }
    finally { creatingRef.current = false; setCreating(false); }
  }, [controls, persistence, active]);
  const layout = buildInteractiveVisualHostLayout(title, controls, status, !!persistence.startNewAttempt);
  return createPortal(<dialog ref={dialog} className={styles.dialog} aria-label={layout.title} aria-modal="true"
    onCancel={(event) => { event.preventDefault(); closeHost(); }} onClick={(event) => event.stopPropagation()}
    onPointerDown={(event) => event.stopPropagation()} onPointerUp={(event) => event.stopPropagation()}
    onKeyDown={(event) => event.stopPropagation()}>
    <motion.div className={styles.shell} initial={reduced ? false : { x: "100%" }} animate={{ x: 0 }} transition={{ duration: .2 }}>
      <header className={styles.header} data-visual-host-header="">
        <h2>{layout.title}</h2><button ref={close} type="button" onClick={closeHost} aria-label="Close interactive visual">Close</button>
      </header>
      <div ref={content} className={styles.content} data-visual-host-content="" data-visual-stage={layout.stageId} inert={creating || undefined}>
        <Suspense fallback={<p role="status">Opening interactive visual…</p>}>
          <Visual key={active.attemptId} attemptId={active.attemptId} attemptNumber={active.attemptNumber} initialSnapshot={active.snapshot} dimensions={dimensions} onControls={setControls} onChange={onChange} />
        </Suspense>
      </div>
      <footer className={styles.footer} data-visual-host-footer="">
        {layout.previous ? <button className={styles.previous} type="button" disabled={creating || !layout.previous.enabled} onClick={layout.previous.run}>Previous</button> : null}
        {layout.backToStart ? <button type="button" onClick={layout.backToStart}>Back to Start</button> : null}
        {layout.showStartNewAttempt ? <button type="button" disabled={creating || controls?.canStartNewAttempt === false || persistence.canStartNewAttempt?.(active.attemptId) === false} onClick={() => { void startNewAttempt(); }}>Start New Attempt</button> : null}
        <p className={styles.status} role="status">{layout.status}</p>
        {layout.next ? <button className={styles.next} type="button" disabled={creating || !layout.next.enabled} onClick={layout.next.run}>{layout.next.label ?? "Next"}</button> : null}
      </footer>
    </motion.div>
  </dialog>, document.body);
}

"use client";

import { Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState, type ComponentType } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "motion/react";
import type { HostedVisualProps, VisualHostControls } from "@/app/step-visuals/core/host";
import type { OpenVisual, VisualPersistence } from "@/lib/interactiveVisuals/persistence";
import { buildInteractiveVisualHostLayout } from "./interactiveVisualHostLayout";
import styles from "./InteractiveVisualHost.module.css";
import VisualRenderBoundary from "./VisualRenderBoundary";

export default function InteractiveVisualHost({ title, opened, persistence, Visual, onClose, returnFocus, onSignIn }: {
  title: string; opened: OpenVisual; persistence: VisualPersistence; Visual: ComponentType<HostedVisualProps>;
  onClose: () => void; returnFocus: HTMLElement;
  onSignIn?: (opened: OpenVisual) => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null), content = useRef<HTMLDivElement>(null), close = useRef<HTMLButtonElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [controls, setControls] = useState<VisualHostControls | null>(null);
  const [status, setStatus] = useState(persistence.statusLabel);
  const [active, setActive] = useState(opened), [creating, setCreating] = useState(false);
  const [renderFailed, setRenderFailed] = useState(false);
  const [signingIn, setSigningIn] = useState(false), [signInFailed, setSignInFailed] = useState(false);
  const creatingRef = useRef(false);
  const reduced = useReducedMotion();
  const recovery = active.restoration?.status === "new-attempt-required";
  const unavailable = renderFailed || active.restoration?.status === "unavailable" || persistence.isAvailable?.(active.attemptId) === false;
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
    catch (error) { if (!persistence.subscribe) setStatus("Changes are pending. Saving failed."); throw error; }
  }, [active, persistence]);
  const startNewAttempt = useCallback(async () => {
    if (creatingRef.current || unavailable || (!recovery && (!controls?.atStart || controls.canStartNewAttempt === false)) || !persistence.startNewAttempt) return;
    if (!window.confirm("Start a new attempt? Your current attempt and its history will be kept.")) return;
    creatingRef.current = true; setCreating(true);
    try { const next = await persistence.startNewAttempt(active); setControls(null); setStatus(persistence.statusLabel); setRenderFailed(false); setActive(next); close.current?.focus({ preventScroll: true }); }
    catch { setStatus("Unable to start a new attempt. Your current work is kept."); }
    finally { creatingRef.current = false; setCreating(false); }
  }, [controls, persistence, active, recovery, unavailable]);
  const layout = buildInteractiveVisualHostLayout(title, unavailable || recovery ? null : controls, status, !!persistence.startNewAttempt);
  return createPortal(<dialog ref={dialog} className={styles.dialog} aria-label={layout.title} aria-modal="true"
    onCancel={(event) => { event.preventDefault(); if (!signingIn) closeHost(); }} onClick={(event) => event.stopPropagation()}
    onPointerDown={(event) => event.stopPropagation()} onPointerUp={(event) => event.stopPropagation()}
    onKeyDown={(event) => event.stopPropagation()}>
    <motion.div className={styles.shell} initial={reduced ? false : { x: "100%" }} animate={{ x: 0 }} transition={{ duration: .2 }}>
      <header className={styles.header} data-visual-host-header="">
        <h2>{layout.title}</h2>
        {onSignIn && !unavailable && (controls?.hasMeaningfulProgress || controls?.completed) ? <button type="button" disabled={signingIn || creating}
          aria-label="Sign in to keep progress across devices" onClick={() => {
            setSigningIn(true); setSignInFailed(false);
            void onSignIn(active).catch(() => { setSignInFailed(true); setSigningIn(false); });
          }} aria-busy={signingIn}>Sign in</button> : null}
        <button ref={close} type="button" disabled={signingIn} onClick={closeHost} aria-label="Close interactive visual">Close</button>
        {signInFailed ? <p className={styles.signInError} role="status">Unable to open sign in. Your work is kept.</p> : null}
      </header>
      <div ref={content} className={styles.content} data-visual-host-content="" data-visual-stage={layout.stageId} inert={creating || signingIn || undefined}>
        {unavailable ? <p role="alert">Interactive visual unavailable. Your saved work is kept.</p> : recovery ?
          <p role="status">This saved attempt cannot be restored. Its history is kept. You can start a new attempt to continue.</p> :
          <VisualRenderBoundary key={active.attemptId} onFailure={() => setRenderFailed(true)}>
            <Suspense fallback={<p role="status">Opening interactive visual…</p>}>
              <Visual attemptId={active.attemptId} attemptNumber={active.attemptNumber} initialSnapshot={active.snapshot} dimensions={dimensions} onControls={setControls} onChange={onChange} />
            </Suspense>
          </VisualRenderBoundary>}
      </div>
      <footer className={styles.footer} data-visual-host-footer="">
        {layout.previous ? <button className={styles.previous} type="button" disabled={creating || signingIn || !layout.previous.enabled} onClick={layout.previous.run}>Previous</button> : null}
        {layout.backToStart ? <button type="button" disabled={signingIn} onClick={layout.backToStart}>Back to Start</button> : null}
        {!unavailable && (recovery && persistence.startNewAttempt || layout.showStartNewAttempt) ? <button type="button" disabled={creating || signingIn || !recovery && controls?.canStartNewAttempt === false || persistence.canStartNewAttempt?.(active.attemptId) === false} onClick={() => { void startNewAttempt(); }}>Start New Attempt</button> : null}
        <p className={styles.status} role="status">{layout.status}</p>
        {layout.next ? <button className={styles.next} type="button" disabled={creating || signingIn || !layout.next.enabled} onClick={layout.next.run}>{layout.next.label ?? "Next"}</button> : null}
      </footer>
    </motion.div>
  </dialog>, document.body);
}

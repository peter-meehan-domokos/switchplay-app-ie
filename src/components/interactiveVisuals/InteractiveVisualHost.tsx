"use client";

import { Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState, type ComponentType } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "motion/react";
import type { HostedVisualProps, VisualContentDimensions, VisualHostControls } from "@/app/step-visuals/core/host";
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
  const topRight = useRef<HTMLElement>(null), bottomRight = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<VisualContentDimensions>({ width: 0, height: 0 });
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
      const viewport = window.visualViewport, element = dialog.current!;
      element.style.setProperty("--visual-viewport-height", `${viewport?.height ?? window.innerHeight}px`);
      element.style.setProperty("--visual-viewport-width", `${viewport?.width ?? window.innerWidth}px`);
      element.style.setProperty("--visual-viewport-top", `${viewport?.offsetTop ?? 0}px`);
      element.style.setProperty("--visual-viewport-left", `${viewport?.offsetLeft ?? 0}px`);
      const rect = content.current!.getBoundingClientRect();
      const region = (node: HTMLElement) => { const box = node.getBoundingClientRect(); return { x: box.x - rect.x, y: box.y - rect.y, width: box.width, height: box.height }; };
      const next = { width: rect.width, height: rect.height, reservedCorners: { topRight: region(topRight.current!), bottomRight: region(bottomRight.current!) } };
      setDimensions(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    };
    const observer = new ResizeObserver(measure); [content.current!, topRight.current!, bottomRight.current!].forEach(node => observer.observe(node)); measure();
    window.addEventListener("resize", measure); window.visualViewport?.addEventListener("resize", measure); window.visualViewport?.addEventListener("scroll", measure);
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); window.visualViewport?.removeEventListener("resize", measure); window.visualViewport?.removeEventListener("scroll", measure); };
  }, []);
  const onChange = useCallback<HostedVisualProps["onChange"]>(async (snapshot, events) => {
    try { await persistence.save(active, snapshot, events); if (!persistence.subscribe) setStatus(persistence.statusLabel); }
    catch (error) { if (!persistence.subscribe) setStatus("Changes are pending. Saving failed."); throw error; }
  }, [active, persistence]);
  const startNewAttempt = useCallback(async () => {
    if (creatingRef.current || unavailable || (!recovery && (!controls?.atStart || controls.canStartNewAttempt === false)) || !persistence.startNewAttempt) return;
    if (!window.confirm("Start a new attempt? All previous attempts, answers and learning history will be kept.")) return;
    creatingRef.current = true; setCreating(true);
    try { const next = await persistence.startNewAttempt(active); setControls(null); setStatus(persistence.statusLabel); setRenderFailed(false); setActive(next); close.current?.focus({ preventScroll: true }); }
    catch { setStatus("Unable to start a new attempt. Your current work is kept."); }
    finally { creatingRef.current = false; setCreating(false); }
  }, [controls, persistence, active, recovery, unavailable]);
  const layout = buildInteractiveVisualHostLayout(title, unavailable || recovery ? null : controls, status, !!persistence.startNewAttempt);
  const notice = layout.status === "Saved" || layout.status === "Development session only" ? null : layout.status;
  const warning = !!notice && /fail|conflict|not safely|unavailable|unable|stopped|offline|reconnect/i.test(notice);
  const showNew = !unavailable && !!persistence.startNewAttempt && (recovery || layout.showStartNewAttempt && controls?.canStartNewAttempt !== false);
  return createPortal(<dialog ref={dialog} className={styles.dialog} aria-label={layout.title} aria-modal="true" data-visual-save-status={layout.status}
    onCancel={(event) => { event.preventDefault(); closeHost(); }} onClick={(event) => event.stopPropagation()}
    onPointerDown={(event) => event.stopPropagation()} onPointerUp={(event) => event.stopPropagation()}
    onKeyDown={(event) => event.stopPropagation()}>
    <motion.div className={styles.shell} initial={reduced ? false : { x: "100%" }} animate={{ x: 0 }} transition={{ duration: .2 }}>
      <header className={styles.titleRow}>
        <h2>{layout.title}</h2>
        {/* Preserve the original title allocation; actual controls stay out of flow. */}
        {onSignIn && !unavailable && (controls?.hasMeaningfulProgress || controls?.completed) ? <span className={styles.titleReservation} aria-hidden="true">Sign in</span> : null}
        <span className={styles.titleReservation} aria-hidden="true">Close</span>
        {signInFailed ? <p className={styles.signInReservation} aria-hidden="true">Unable to open sign in. Your work is kept.</p> : null}
      </header>
      <nav ref={topRight} className={`${styles.corner} ${styles.topRight}`} data-visual-host-header="" aria-label="Attempt and close controls">
        {showNew ? <button type="button" disabled={creating || signingIn || persistence.canStartNewAttempt?.(active.attemptId) === false} onClick={() => { void startNewAttempt(); }}>New</button> : null}
        <button ref={close} type="button" onClick={closeHost} aria-label="Close interactive visual">Close</button>
      </nav>
      <div ref={content} className={styles.content} data-visual-host-content="" data-visual-stage={layout.stageId} inert={creating || signingIn || undefined}>
        {unavailable ? <p role="alert">Interactive visual unavailable. Your saved work is kept.</p> : recovery ?
          <p role="status">This saved attempt cannot be restored. Its history is kept. You can start a new attempt to continue.</p> :
          <VisualRenderBoundary key={active.attemptId} onFailure={() => setRenderFailed(true)}>
            <Suspense fallback={<p role="status">Opening interactive visual…</p>}>
              <Visual attemptId={active.attemptId} attemptNumber={active.attemptNumber} initialSnapshot={active.snapshot} dimensions={dimensions} onControls={setControls} onChange={onChange} />
            </Suspense>
          </VisualRenderBoundary>}
      </div>
      {/* Keep the original intrinsic footer sizing, without old interactive controls or panels. */}
      <div className={styles.footerReservation} aria-hidden="true">
        {layout.previous ? <span className={`${styles.reservationButton} ${styles.reservationPrevious}`}>Previous</span> : null}
        {layout.backToStart ? <span className={styles.reservationButton}>Back to Start</span> : null}
        {!unavailable && (recovery && persistence.startNewAttempt || layout.showStartNewAttempt) ? <span className={styles.reservationButton}>Start New Attempt</span> : null}
        <p className={styles.reservationStatus} data-label={layout.status} />
        {layout.next ? <span className={`${styles.reservationButton} ${styles.reservationNext}`}>{layout.next.label ?? "Next"}</span> : null}
      </div>
      <div ref={bottomRight} className={`${styles.corner} ${styles.bottomRight}`} data-visual-host-footer="">
        {onSignIn && !unavailable && (controls?.hasMeaningfulProgress || controls?.completed) ? <button type="button" disabled={signingIn || creating}
          aria-label="Sign in to keep progress across devices" onClick={() => {
            setSigningIn(true); setSignInFailed(false);
            void onSignIn(active).catch(() => { setSignInFailed(true); setSigningIn(false); });
          }} aria-busy={signingIn}>Sign in</button> : null}
        {signInFailed ? <p className={`${styles.status} ${styles.warning}`} role="alert">Unable to open sign in. Your work is kept.</p> : null}
        {notice ? <p className={`${styles.status}${warning ? ` ${styles.warning}` : ""}`} role={warning ? "alert" : "status"}>{notice}</p> : null}
        <nav className={styles.navigation} aria-label="Stage navigation">
          {layout.previous ? <button type="button" disabled={creating || signingIn || !layout.previous.enabled} onClick={layout.previous.run}>Back</button> : null}
          {layout.backToStart ? <button type="button" disabled={creating || signingIn} onClick={layout.backToStart}>Rewind</button>
            : layout.next ? <button type="button" disabled={creating || signingIn || !layout.next.enabled} onClick={layout.next.run}>{layout.next.label ?? "Next"}</button> : null}
        </nav>
      </div>
    </motion.div>
  </dialog>, document.body);
}

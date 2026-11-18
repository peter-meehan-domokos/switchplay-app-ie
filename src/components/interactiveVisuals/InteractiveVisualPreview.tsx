"use client";

import { useEffect, useRef, useState } from "react";
import { getInteractiveVisual } from "@/lib/interactiveVisuals/catalogue";
import type { OpenVisual, VisualOrigin, VisualPersistence } from "@/lib/interactiveVisuals/persistence";
import InteractiveVisualHost from "./InteractiveVisualHost";
import { interactiveVisualComponent } from "./registry";
import styles from "./InteractiveVisualHost.module.css";

class PreviewDeadlineError extends Error {}
/** Bound UI waiting, including storage before fetch. Never retry a timed-out mutation. */
function previewRequest<T>(run: () => Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); signal.removeEventListener("abort", abort); };
    const abort = () => { cleanup(); reject(new DOMException("Preview closed", "AbortError")); };
    const timer = setTimeout(() => { cleanup(); reject(new PreviewDeadlineError()); }, 15_000);
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) { abort(); return; }
    Promise.resolve().then(run).then(value => { cleanup(); resolve(value); }, error => { cleanup(); reject(error); });
  });
}

export default function InteractiveVisualPreview({ activityId, origin, persistence, onOpen, onClose, onSignIn, autoOpen = false }: {
  activityId: string; origin: VisualOrigin; persistence?: VisualPersistence | null; onOpen?: () => void;
  onClose?: () => void; onSignIn?: (opened: OpenVisual) => Promise<void>;
  autoOpen?: boolean;
}) {
  const visual = getInteractiveVisual(activityId), Visual = interactiveVisualComponent(activityId);
  const [session, setSession] = useState<{ opened: OpenVisual; source: HTMLElement } | null>(null);
  const [pending, setPending] = useState(false), [failed, setFailed] = useState("");
  const [lookup, setLookup] = useState(0), [openingTimedOut, setOpeningTimedOut] = useState(false);
  const [known, setKnown] = useState<{ service: typeof persistence; activityId: string; lookup: number; exists: boolean | null } | null>(null);
  const button = useRef<HTMLButtonElement>(null), resumed = useRef(false);
  const opening = useRef<AbortController | null>(null);
  useEffect(() => () => { opening.current?.abort(); }, []);
  useEffect(() => {
    const controller = new AbortController();
    void previewRequest(() => persistence ? persistence.hasAttempt(activityId) : new Promise<boolean>(() => {}), controller.signal)
      .then(exists => { if (!controller.signal.aborted) setKnown({ service: persistence, activityId, lookup, exists }); })
      .catch(() => { if (!controller.signal.aborted) setKnown({ service: persistence, activityId, lookup, exists: null }); });
    return () => { controller.abort(); };
  }, [activityId, persistence, lookup]);
  const current = known && known.service === persistence && known.activityId === activityId && known.lookup === lookup ? known : null;
  const exists = current?.exists ?? null, lookupFailed = !!current && exists === null;
  const action = exists === null ? null : exists ? "Continue" : "Start";
  const reload = openingTimedOut || lookupFailed && !persistence;
  const retry = lookupFailed && !reload;
  const busy = pending || !action && !lookupFailed;
  const error = failed || (lookupFailed ? persistence ? "Unable to check progress. Retry or reload this page."
    : "Unable to prepare the interactive visual. Reload this page to retry." : "");
  useEffect(() => {
    // Only the explicit sign-in return opts in. A passive preview never opens.
    if (autoOpen && persistence && action && !resumed.current) { resumed.current = true; button.current?.click(); }
  }, [autoOpen, persistence, action]);
  if (!visual || !Visual) return <p>Interactive visual unavailable.</p>;
  return <>
    <button ref={button} type="button" className={styles.preview} data-interactive-visual-preview="" disabled={pending || !action && !lookupFailed && !reload}
      aria-busy={busy} aria-label={reload ? `Reload to open: ${visual.title}` : retry ? `Retry checking progress: ${visual.title}` : action ? `${action}: ${visual.title}` : `Loading ${visual.title}`} onClick={async (event) => {
      if (reload) { window.location.reload(); return; }
      if (retry) { setFailed(""); setLookup(value => value + 1); return; }
      if (!persistence || !action || opening.current) return;
      const source = event.currentTarget;
      const controller = new AbortController(); opening.current = controller;
      setPending(true); setFailed("");
      try {
        onOpen?.();
        const opened = await previewRequest(() => persistence.open(activityId, origin), controller.signal);
        if (!controller.signal.aborted) { setKnown({ service: persistence, activityId, lookup, exists: true }); setSession({ opened, source }); }
      } catch (error) {
        if (!controller.signal.aborted) {
          setOpeningTimedOut(error instanceof PreviewDeadlineError);
          setFailed(error instanceof PreviewDeadlineError ? "Unable to open. Reload this page to retry. Your work is kept."
            : error instanceof Error && error.message === "VISUAL_RELEASE_MISMATCH" ? "This visual needs an app update. Reload to continue." : "Unable to open. Try again.");
        }
      } finally { if (!controller.signal.aborted) setPending(false); if (opening.current === controller) opening.current = null; }
    }}>
      {/* Generated initial-state image; never mounts an activity or starts an attempt. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- Local generated preview, no image service needed. */}
      {visual.preview ? <img src={visual.preview} alt={`${visual.title}: initial view`} /> : null}
      <span className={styles.previewAction}>{reload ? "Reload" : retry ? "Retry" : action ?? <span className={styles.loading} aria-hidden="true" />}</span>
    </button>
    {error ? <p role="alert" className={styles.previewError}>{error}</p> : null}
    {session && persistence ? <InteractiveVisualHost title={visual.title} opened={session.opened} persistence={persistence} Visual={Visual}
      returnFocus={session.source} onSignIn={onSignIn} onClose={() => { setSession(null); onClose?.(); }} /> : null}
  </>;
}

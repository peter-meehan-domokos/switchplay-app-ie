"use client";

import { useEffect, useRef, useState } from "react";
import { getInteractiveVisual } from "@/lib/interactiveVisuals/catalogue";
import type { OpenVisual, VisualOrigin, VisualPersistence } from "@/lib/interactiveVisuals/persistence";
import InteractiveVisualHost from "./InteractiveVisualHost";
import { interactiveVisualComponent } from "./registry";
import styles from "./InteractiveVisualHost.module.css";

export default function InteractiveVisualPreview({ activityId, origin, persistence, onOpen, onClose, onSignIn, autoOpen = false }: {
  activityId: string; origin: VisualOrigin; persistence?: VisualPersistence | null; onOpen?: () => void;
  onClose?: () => void; onSignIn?: (opened: OpenVisual) => Promise<void>;
  autoOpen?: boolean;
}) {
  const visual = getInteractiveVisual(activityId), Visual = interactiveVisualComponent(activityId);
  const [session, setSession] = useState<{ opened: OpenVisual; source: HTMLElement } | null>(null);
  const [pending, setPending] = useState(false), [failed, setFailed] = useState("");
  const [known, setKnown] = useState<{ service: VisualPersistence; activityId: string; exists: boolean } | null>(null);
  const button = useRef<HTMLButtonElement>(null), resumed = useRef(false);
  useEffect(() => {
    let live = true;
    if (persistence) void persistence.hasAttempt(activityId).then(exists => {
      if (live) setKnown({ service: persistence, activityId, exists });
    }).catch(() => { if (live) setFailed("Unable to check progress. Reopen this tab to retry."); });
    return () => { live = false; };
  }, [activityId, persistence]);
  const exists = known && known.service === persistence && known.activityId === activityId ? known.exists : null;
  const action = exists === null ? null : exists ? "Continue" : "Start";
  useEffect(() => {
    // Only the explicit sign-in return opts in. A passive preview never opens.
    if (autoOpen && persistence && action && !resumed.current) { resumed.current = true; button.current?.click(); }
  }, [autoOpen, persistence, action]);
  if (!visual || !Visual) return <p>Interactive visual unavailable.</p>;
  return <>
    <button ref={button} type="button" className={styles.preview} data-interactive-visual-preview="" disabled={pending || !persistence || !action}
      aria-busy={pending || !action} aria-label={action ? `${action}: ${visual.title}` : `Loading ${visual.title}`} onClick={async (event) => {
      if (!persistence) return;
      const source = event.currentTarget;
      setPending(true); setFailed(""); onOpen?.();
      try { const opened = await persistence.open(activityId, origin); setKnown({ service: persistence, activityId, exists: true }); setSession({ opened, source }); }
      catch (error) { setFailed(error instanceof Error && error.message === "VISUAL_RELEASE_MISMATCH"
        ? "This visual needs an app update. Reload to continue." : "Unable to open. Try again."); }
      finally { setPending(false); }
    }}>
      {/* Generated initial-state image; never mounts an activity or starts an attempt. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- Local generated preview, no image service needed. */}
      {visual.preview ? <img src={visual.preview} alt={`${visual.title}: initial view`} /> : null}
      <span className={styles.previewAction}>{action ?? <span className={styles.loading} aria-hidden="true" />}</span>
    </button>
    {failed ? <p role="alert" className={styles.previewError}>{failed}</p> : null}
    {session && persistence ? <InteractiveVisualHost title={visual.title} opened={session.opened} persistence={persistence} Visual={Visual}
      returnFocus={session.source} onSignIn={onSignIn} onClose={() => { setSession(null); onClose?.(); }} /> : null}
  </>;
}

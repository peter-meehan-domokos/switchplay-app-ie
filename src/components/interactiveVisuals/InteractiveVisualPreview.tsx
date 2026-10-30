"use client";

import { useState } from "react";
import { getInteractiveVisual } from "@/lib/interactiveVisuals/catalogue";
import type { OpenVisual, VisualOrigin, VisualPersistence } from "@/lib/interactiveVisuals/persistence";
import InteractiveVisualHost from "./InteractiveVisualHost";
import { interactiveVisualComponent } from "./registry";
import styles from "./InteractiveVisualHost.module.css";

export default function InteractiveVisualPreview({ activityId, origin, persistence, onOpen }: {
  activityId: string; origin: VisualOrigin; persistence: VisualPersistence; onOpen?: () => void;
}) {
  const visual = getInteractiveVisual(activityId), Visual = interactiveVisualComponent(activityId);
  const [session, setSession] = useState<{ opened: OpenVisual; source: HTMLElement } | null>(null);
  const [pending, setPending] = useState(false), [failed, setFailed] = useState("");
  if (!visual || !Visual) return <p>Interactive visual unavailable.</p>;
  return <>
    <button type="button" className={styles.preview} disabled={pending} aria-label={`Open ${visual.title}`} onClick={async (event) => {
      const source = event.currentTarget;
      setPending(true); setFailed(""); onOpen?.();
      try { const opened = await persistence.open(activityId, origin); setSession({ opened, source }); }
      catch (error) { setFailed(error instanceof Error && error.message === "VISUAL_RELEASE_MISMATCH"
        ? "This visual needs an app update. Reload to continue." : "Unable to open. Try again."); }
      finally { setPending(false); }
    }}>
      {/* Generated initial-state image; never mounts an activity or starts an attempt. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- Local generated preview, no image service needed. */}
      {visual.preview ? <img src={visual.preview} alt={`${visual.title}: initial view`} /> : null}
      <span>{pending ? "Opening…" : failed || `Open ${visual.title}`}</span>
    </button>
    {session ? <InteractiveVisualHost title={visual.title} opened={session.opened} persistence={persistence} Visual={Visual}
      returnFocus={session.source} onClose={() => setSession(null)} /> : null}
  </>;
}

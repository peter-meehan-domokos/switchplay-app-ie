"use client";

import { useId, useState } from "react";
import RootsFactorsActivity from "../activities/roots-factors/RootsFactorsActivity";
import { useSurfaceActive } from "../platform/web/SurfaceLifecycle";
import RootsFactorsLayoutPreview from "./RootsFactorsLayoutPreview";
import type { LayoutPreviewMode } from "./layoutPreviewFixtures";
import styles from "./Lab.module.css";

export type LabActivityMode = "guided" | LayoutPreviewMode;

/** Lab owns visibility and explicit restart identity, never the mathematical or learning state. */
export default function RootsFactorsLabSession({ mode, onExit }: { mode: LabActivityMode; onExit: () => void }) {
  const [session, setSession] = useState(0);
  const [note, setNote] = useState("");
  const noteId = useId();
  const active = useSurfaceActive();
  return <>
    <RootsFactorsActivity key={session} visible={mode === "guided"} onExit={onExit} />
    {mode !== "guided" ? <RootsFactorsLayoutPreview mode={mode} onExit={onExit} /> : null}
    {mode === "guided" ? <div className={styles.spvGuidedTools}>
      <p className={styles.spvPreviewDisclaimer}>Guided activity · retrieval assessment follows in Checkpoint 5.</p>
      <button className={styles.spvRestart} type="button" disabled={!active} onClick={() => setSession((value) => value + 1)}>Restart guided activity</button>
    </div> : null}
    <details className={styles.spvSessionProbe}>
      <summary>Lab session test</summary>
      <label htmlFor={noteId}>Session note</label>
      <input id={noteId} value={note} disabled={!active} onChange={(event) => setNote(event.target.value)} autoComplete="off" />
    </details>
  </>;
}

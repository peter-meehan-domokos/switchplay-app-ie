"use client";

import { StrictMode, useId, useState } from "react";
import RootsFactorsActivity from "../activities/roots-factors/RootsFactorsActivity";
import { useSurfaceActive } from "../platform/web/SurfaceLifecycle";
import RootsFactorsLayoutPreview from "./RootsFactorsLayoutPreview";
import SparklinePreview from "./SparklinePreview";
import type { LayoutPreviewMode } from "./layoutPreviewFixtures";
import styles from "./Lab.module.css";
import type { Card1LearningCallbacks } from "../activities/roots-factors/learningRecords";

export type LabActivityMode = "guided" | LayoutPreviewMode | "sparkline";

/** Lab owns visibility and explicit restart requests, never mathematical or learning state. */
export default function RootsFactorsLabSession({ mode, onExit, onExitRequest, exitKey, ...callbacks }: Card1LearningCallbacks & { mode: LabActivityMode; onExit: () => void; onExitRequest: () => void; exitKey: number }) {
  const [session, setSession] = useState(0);
  const [note, setNote] = useState("");
  const noteId = useId();
  const active = useSurfaceActive();
  return <>
    <StrictMode><RootsFactorsActivity restartKey={session} exitKey={exitKey} visible={mode === "guided"} onExit={onExit} {...callbacks} /></StrictMode>
    {mode === "sparkline" ? <SparklinePreview /> : mode !== "guided" ? <RootsFactorsLayoutPreview mode={mode} onExit={onExitRequest} /> : null}
    {mode === "guided" ? <div className={styles.spvGuidedTools}>
      <button className={styles.spvRestart} type="button" disabled={!active} onClick={() => setSession((value) => value + 1)}>Restart guided activity</button>
    </div> : null}
    <details className={styles.spvSessionProbe}>
      <summary>Lab session test</summary>
      <label htmlFor={noteId}>Session note</label>
      <input id={noteId} value={note} disabled={!active} onChange={(event) => setNote(event.target.value)} autoComplete="off" />
    </details>
  </>;
}

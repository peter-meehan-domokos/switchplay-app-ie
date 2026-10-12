"use client";

import { useId, useState } from "react";
import RootsFactorsView from "../activities/roots-factors/RootsFactorsView";
import { useSurfaceActive } from "../platform/web/SurfaceLifecycle";
import { layoutPreviewFixtures, type LayoutPreviewMode } from "./layoutPreviewFixtures";
import styles from "./Lab.module.css";

/** Temporary lab-owned preview/session probe. Never exported from the activity public API. */
export default function RootsFactorsLayoutPreview({ mode, onExit }: { mode: LayoutPreviewMode; onExit: () => void }) {
  const [note, setNote] = useState("");
  const active = useSurfaceActive();
  const noteId = useId();
  const fixture = layoutPreviewFixtures[mode];
  return (
    <>
      <RootsFactorsView math={fixture.math} presentation={fixture.presentation} onExit={onExit} />
      <p className={styles.spvPreviewDisclaimer}>Static layout preview · learning controls are inactive.</p>
      <details className={styles.spvSessionProbe}>
        <summary>Lab session test</summary>
        <label htmlFor={noteId}>Session note</label>
        <input id={noteId} value={note} disabled={!active} onChange={(event) => setNote(event.target.value)} autoComplete="off" />
      </details>
    </>
  );
}

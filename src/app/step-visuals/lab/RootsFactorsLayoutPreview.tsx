"use client";

import { useId, useState } from "react";
import RootsFactorsController from "../activities/roots-factors/RootsFactorsController";
import { useSurfaceActive } from "../platform/web/SurfaceLifecycle";
import { layoutPreviewFixtures, previewInputPolicies, type LayoutPreviewMode } from "./layoutPreviewFixtures";
import styles from "./Lab.module.css";

/** Temporary lab-owned preview/session probe. Never exported from the activity public API. */
export default function RootsFactorsLayoutPreview({ mode, onExit }: { mode: LayoutPreviewMode; onExit: () => void }) {
  const [note, setNote] = useState("");
  const active = useSurfaceActive();
  const noteId = useId();
  const fixture = layoutPreviewFixtures[mode];
  return (
    <>
      <RootsFactorsController initialMath={fixture.math} presentation={fixture.presentation} contextKey={mode} inputPolicy={previewInputPolicies[mode]} onExit={onExit} />
      <p className={styles.spvPreviewDisclaimer}>Root manipulation preview · learning actions remain inactive.</p>
      <details className={styles.spvSessionProbe}>
        <summary>Lab session test</summary>
        <label htmlFor={noteId}>Session note</label>
        <input id={noteId} value={note} disabled={!active} onChange={(event) => setNote(event.target.value)} autoComplete="off" />
      </details>
    </>
  );
}

"use client";

import RootsFactorsController from "../activities/roots-factors/RootsFactorsController";
import { layoutPreviewFixtures, previewInputPolicies, type LayoutPreviewMode } from "./layoutPreviewFixtures";
import styles from "./Lab.module.css";

/** Temporary lab-owned preview/session probe. Never exported from the activity public API. */
export default function RootsFactorsLayoutPreview({ mode, onExit }: { mode: LayoutPreviewMode; onExit: () => void }) {
  const fixture = layoutPreviewFixtures[mode];
  return (
    <>
      <RootsFactorsController initialMath={fixture.math} presentation={fixture.presentation} contextKey={mode} inputPolicy={previewInputPolicies[mode]} onExit={onExit} />
      <p className={styles.spvPreviewDisclaimer}>Root manipulation preview · learning actions remain inactive.</p>
    </>
  );
}

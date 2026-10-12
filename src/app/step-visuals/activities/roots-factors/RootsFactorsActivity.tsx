"use client";

import { useId, useState } from "react";
import ActivityFrame from "../../platform/web/ActivityFrame";
import { useSurfaceActive } from "../../platform/web/SurfaceLifecycle";
import styles from "./RootsFactorsActivity.module.css";

export type RootsFactorsActivityProps = Readonly<{ onExit?: () => void }>;

/** Checkpoint 1 placeholder: no mathematical model or pedagogical interactions yet. */
export default function RootsFactorsActivity({ onExit }: RootsFactorsActivityProps) {
  const [note, setNote] = useState("");
  const noteId = useId();
  const active = useSurfaceActive();

  return (
    <ActivityFrame
      title="Roots and factors"
      eyebrow="Card 1 · Interactive visualisation"
      onExit={onExit}
      graph={
        <div className={styles.spvGraphPlaceholder}>
          <span className={styles.spvPlaceholderLabel}>Graph canvas</span>
          <p className={styles.spvPlaceholderCopy}>The interactive graph will appear here.</p>
        </div>
      }
      expression={<p className={styles.spvExpressionPlaceholder}>Factor expression</p>}
      prompt={
        <fieldset className={styles.spvPreviewNote} disabled={!active}>
          <p className={styles.spvPromptTitle}>Frame preview</p>
          <p className={styles.spvPlaceholderCopy}>The guided activity will follow in the next checkpoints.</p>
          <label className={styles.spvNoteLabel} htmlFor={noteId}>Session note</label>
          <input
            className={styles.spvNoteInput}
            id={noteId}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Optional note for this preview"
            autoComplete="off"
          />
        </fieldset>
      }
    />
  );
}

"use client";

import { useState } from "react";
import type { Card1LearningEvent, Card1LearningResult, Card1SessionRecords } from "../activities/roots-factors/learningRecords";
import styles from "./Lab.module.css";

/** An optional lab consumer of the public callbacks. Never part of the reusable activity. */
export default function LearningRecordPreview({ records, events, completed }: {
  records: Card1SessionRecords | null; events: readonly Card1LearningEvent[]; completed: readonly Card1LearningResult[];
}) {
  const [open, setOpen] = useState(false);
  return <details className={styles.spvSessionProbe} onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary>Learning records</summary>
    {open ? <pre className={styles.spvRecordJSON} data-spv-records>{JSON.stringify({ records, receivedEvents: events,
      receivedCompletions: completed }, null, 2)}</pre> : null}
  </details>;
}

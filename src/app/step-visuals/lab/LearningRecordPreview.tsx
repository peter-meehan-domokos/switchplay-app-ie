"use client";

import { useState } from "react";
import styles from "./Lab.module.css";

/** An optional lab consumer of the public callbacks. Never part of the reusable activity. */
export default function LearningRecordPreview({ records, events, completed }: {
  records: unknown; events: readonly unknown[]; completed: readonly unknown[];
}) {
  const [open, setOpen] = useState(false);
  return <details className={styles.spvSessionProbe} onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary>Learning records</summary>
    {open ? <pre className={styles.spvRecordJSON} data-spv-records>{JSON.stringify({ records, receivedEvents: events,
      receivedCompletions: completed }, null, 2)}</pre> : null}
  </details>;
}

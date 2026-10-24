"use client";

import { useCallback, useRef, useState } from "react";
import IntegrationActivity from "../activities/integration-area/integration-activity";
import type { IntegrationEvent, IntegrationRecords, IntegrationResult } from "../activities/integration-area/records";
import LearningRecordPreview from "./LearningRecordPreview";

/** A host consuming the same public deliveries as Puckle; it owns no mathematical state. */
export default function IntegrationLabSession({ exitKey, onExit }: { exitKey: number; onExit: () => void }) {
  const [records, setRecords] = useState<IntegrationRecords | null>(null);
  const [events, setEvents] = useState<readonly IntegrationEvent[]>([]);
  const [completed, setCompleted] = useState<readonly IntegrationResult[]>([]);
  const lastSnapshot = useRef<IntegrationRecords | null>(null);
  const received = useRef<IntegrationEvent[]>([]);
  const onEvent = useCallback((event: IntegrationEvent) => {
    received.current.push(event);
    setEvents((previous) => [...previous, event]);
  }, []);
  const onComplete = useCallback((result: IntegrationResult) => setCompleted((previous) => [...previous, result]), []);
  const onRecordsChange = useCallback((snapshot: IntegrationRecords) => {
    if (snapshot === lastSnapshot.current) return;
    lastSnapshot.current = snapshot;
    if (process.env.NODE_ENV === "development") {
      const actions = received.current.map((event) => event.type).join(" + ") || "session snapshot";
      console.groupCollapsed(`[Step Visuals · Integration · attempt ${snapshot.current.attemptNumber}] ${actions}`);
      console.log(snapshot);
      console.groupEnd();
    }
    received.current = [];
    setRecords(snapshot);
  }, []);
  return <>
    <IntegrationActivity exitKey={exitKey} onExit={onExit} onEvent={onEvent} onComplete={onComplete} onRecordsChange={onRecordsChange} />
    <LearningRecordPreview records={records} events={events} completed={completed} />
  </>;
}

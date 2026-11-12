"use client";

import { useEffect, useRef } from "react";
import type { Card1LearningCallbacks, Card1SessionRecords } from "../../activities/roots-factors/learningRecords";

export const createAttemptId = (): string => {
  if (globalThis.crypto.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
};
export type LearningDeliveryCursor = { sequence: number; records: Card1SessionRecords | null; delivering: boolean };
export const createLearningDeliveryCursor = (): LearningDeliveryCursor => ({ sequence: 0, records: null, delivering: false });

const notify = (callback: (() => void) | undefined) => {
  try { callback?.(); } catch (error) { console.error("Step Visuals learning callback failed", error); }
};

/** Delivery only: assessment and snapshots have already been decided by the pure reducer. */
export const deliverLearningNotifications = (records: Card1SessionRecords, cursor: LearningDeliveryCursor, callbacks: Card1LearningCallbacks & { onExit?: () => void }) => {
  if (cursor.delivering) return;
  cursor.delivering = true;
  try {
    let exited = false;
    while (cursor.sequence < records.events.length) {
      const event = records.events[cursor.sequence];
      cursor.sequence = event.sequence; // Advance before user callbacks, including reentrant delivery.
      notify(callbacks.onEvent ? () => callbacks.onEvent!(event) : undefined);
      if (event.type === "attempt-completed") notify(callbacks.onComplete ? () => callbacks.onComplete!(event.result) : undefined);
      if (event.type === "attempt-exited") exited = true;
    }
    if (!callbacks.onRecordsChange) cursor.records = null;
    else if (cursor.records !== records) {
      cursor.records = records;
      notify(() => callbacks.onRecordsChange!(records));
    }
    // A host may unmount immediately; deliver its final data before invoking navigation.
    if (exited) notify(callbacks.onExit);
  } finally { cursor.delivering = false; }
};

export const useLearningNotifications = (records: Card1SessionRecords, callbacks: Card1LearningCallbacks & { onExit?: () => void }) => {
  const cursor = useRef<LearningDeliveryCursor | null>(null);
  const { onComplete, onEvent, onRecordsChange, onExit } = callbacks;
  useEffect(() => {
    cursor.current ??= createLearningDeliveryCursor();
    deliverLearningNotifications(records, cursor.current, { onComplete, onEvent, onRecordsChange, onExit });
  }, [records, onComplete, onEvent, onRecordsChange, onExit]);
};

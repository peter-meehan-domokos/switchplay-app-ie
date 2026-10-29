"use client";

import { useEffect, useRef } from "react";
import type { IntegrationCallbacks, IntegrationRecords } from "./records";

type DeliveryCallbacks = IntegrationCallbacks & Readonly<{ onExit?: () => void }>;
export type IntegrationCursor = {
  sequence: number;
  records: IntegrationRecords | null;
  delivering: boolean;
};

/** Platform identity only: reducers receive an opaque ID as an explicit input. */
export const createIntegrationAttemptId = (): string => {
  if (globalThis.crypto.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
};

export const createIntegrationCursor = (): IntegrationCursor => ({ sequence: 0, records: null, delivering: false });

const notify = (callback: (() => void) | undefined) => {
  try { callback?.(); } catch (error) { console.error("Step Visuals integration callback failed", error); }
};

/**
 * Deliver accepted facts only. Events have contiguous session-wide sequences starting at 1.
 * Event/completion subscribers receive future notifications, not historical replay.
 * A newly attached snapshot subscriber can inspect the current and archived attempts.
 * Cursors protect a mounted session, not durable delivery across remounts or crashes.
 */
export const deliverIntegrationNotifications = (
  records: IntegrationRecords,
  cursor: IntegrationCursor,
  callbacks: DeliveryCallbacks,
) => {
  if (cursor.delivering) return;
  cursor.delivering = true;
  try {
    let exited = false;
    while (cursor.sequence < records.events.length) {
      const event = records.events[cursor.sequence];
      cursor.sequence = event.sequence; // Claim delivery before invoking potentially reentrant host code.
      notify(callbacks.onEvent ? () => callbacks.onEvent!(event) : undefined);
      if (event.type === "attempt-completed") {
        notify(callbacks.onComplete ? () => callbacks.onComplete!(event.result) : undefined);
      }
      if (event.type === "attempt-exited") exited = true;
    }
    if (!callbacks.onRecordsChange) cursor.records = null;
    else if (cursor.records !== records) {
      cursor.records = records;
      notify(() => callbacks.onRecordsChange!(records));
    }
    // The host may unmount immediately on exit; its evidence must arrive first.
    if (exited) notify(callbacks.onExit);
  } finally { cursor.delivering = false; }
};

/** Effects deliver facts after commit, outside rendering and pure state transitions. */
export const useIntegrationNotifications = (records: IntegrationRecords, callbacks: DeliveryCallbacks) => {
  const cursor = useRef<IntegrationCursor | null>(null);
  const { onEvent, onComplete, onRecordsChange, onExit } = callbacks;
  useEffect(() => {
    cursor.current ??= createIntegrationCursor();
    deliverIntegrationNotifications(records, cursor.current, { onEvent, onComplete, onRecordsChange, onExit });
  }, [records, onEvent, onComplete, onRecordsChange, onExit]);
};

"use client";

import type { VisualPersistence, OpenVisual, VisualOrigin } from "../interactiveVisuals/persistence";
import { createBrowserVisualStore, type VisualOutboxStore } from "./browserStore";
import { acknowledgeVisualBatch, enqueueVisualChange, freezeVisualBatch, hasPendingVisualWork, initialVisualOutbox, visualOutboxKey,
  type VisualOutbox, type VisualSession } from "./outbox";
import { requireVisual } from "./contracts";
import type { BatchAcknowledgement } from "./model";

class VisualTransportError extends Error {
  constructor(readonly status: number, readonly code: string, readonly retryAfter = 0) { super(code); }
}
type Options = Readonly<{ learner: string; store?: VisualOutboxStore; fetch?: typeof fetch; uuid?: () => string }>;
export function createAccountVisualPersistence(options: Options): VisualPersistence & { dispose: () => void } {
  const store = options.store ?? createBrowserVisualStore(), send = options.fetch ?? fetch, uuid = options.uuid ?? (() => crypto.randomUUID());
  const keys = new Map<string, string>(), listeners = new Map<string, Set<(status: string) => void>>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>(), sending = new Map<string, Promise<void>>();
  const errors = new Map<string, string>(), dirtySince = new Map<string, number>(), failures = new Map<string, number>();
  const retryAt = new Map<string, number>();
  const localFailures = new Set<string>(), stopped = new Set<string>();
  const controller = new AbortController(); let disposed = false;
  const label = (row: VisualOutbox) => localFailures.has(row.session.attemptId) ? "Saving failed. Changes are not safely stored on this device."
    : row.conflict ? "Saving conflict. Your pending work is kept on this device."
    : errors.get(row.session.attemptId) ?? (hasPendingVisualWork(row) ? "Changes pending" : "Saved");
  function notify(row: VisualOutbox) { listeners.get(row.session.attemptId)?.forEach(listener => listener(label(row))); }
  async function request<T>(path: string, body: unknown): Promise<T> {
    requireVisual(!disposed, "VISUAL_SESSION_CLOSED");
    const abort = new AbortController(), cancel = () => abort.abort();
    controller.signal.addEventListener("abort", cancel, { once: true });
    const timeout = setTimeout(cancel, 12000);
    try {
      const response = await send(path, { method: "POST", credentials: "same-origin", cache: "no-store", signal: abort.signal,
        headers: { "Content-Type": "application/json", "X-Visual-Learner": options.learner }, body: JSON.stringify(body) });
      const value = await response.json();
      if (!response.ok) throw new VisualTransportError(response.status, typeof value.code === "string" ? value.code : "VISUAL_REQUEST_FAILED", Number(response.headers.get("Retry-After")) * 1000 || 0);
      requireVisual(response.headers.get("X-Visual-Learner") === options.learner, "VISUAL_SESSION_CONFLICT");
      return value as T;
    } finally { clearTimeout(timeout); controller.signal.removeEventListener("abort", cancel); }
  }
  function schedule(attemptId: string, delay = 1500) {
    if (disposed || stopped.has(attemptId)) return;
    const old = timers.get(attemptId); if (old) clearTimeout(old);
    const since = dirtySince.get(attemptId) ?? Date.now(); dirtySince.set(attemptId, since);
    timers.set(attemptId, setTimeout(() => { timers.delete(attemptId); void flush(attemptId); }, Math.max(0, (retryAt.get(attemptId) ?? 0) - Date.now(), Math.min(delay, 5000 - (Date.now() - since)))));
  }
  async function flush(attemptId: string): Promise<void> {
    if (disposed || stopped.has(attemptId)) return;
    if ((retryAt.get(attemptId) ?? 0) > Date.now()) { schedule(attemptId); return; }
    const current = sending.get(attemptId); if (current) return current;
    const key = keys.get(attemptId); if (!key) return;
    const task = (async () => {
      let row = await store.read(key);
      if (!row || row.session.attemptId !== attemptId || row.conflict) return;
      try {
        while (!disposed && hasPendingVisualWork(row) && !row.conflict) {
          if (row.visits.length) {
            const visit = row.visits[0];
            const session = await request<VisualSession>("/api/visual-sessions/open", { activityId: row.session.activityId, ...visit });
            requireVisual(session.learner === options.learner, "VISUAL_SESSION_CONFLICT");
            row = await store.update(key, latest => {
              requireVisual(latest && latest.session.attemptId === attemptId, "VISUAL_SESSION_CONFLICT");
              return session.attemptId === attemptId ? { ...latest, visits: latest.visits.filter(v => v.visitId !== visit.visitId) } : { ...latest, conflict: true };
            });
            errors.delete(attemptId); failures.delete(attemptId); retryAt.delete(attemptId); notify(row); continue;
          }
          row = await store.update(key, latest => { requireVisual(latest && latest.session.attemptId === attemptId, "VISUAL_SESSION_CONFLICT"); return freezeVisualBatch(latest, uuid()); });
          if (!row.flight) break;
          const ack = await request<BatchAcknowledgement>(`/api/visual-attempts/${attemptId}/batches`, row.flight.batch);
          row = await store.update(key, latest => { requireVisual(latest && latest.session.attemptId === attemptId, "VISUAL_SESSION_CONFLICT"); return acknowledgeVisualBatch(latest, ack); });
          errors.delete(attemptId); failures.delete(attemptId); retryAt.delete(attemptId); notify(row);
        }
        if (!hasPendingVisualWork(row)) { dirtySince.delete(attemptId); notify(row); }
      } catch (error) {
        if (disposed) return;
        const terminal = error instanceof VisualTransportError && [400, 401, 403, 404, 409, 413].includes(error.status)
          || error instanceof Error && /VISUAL_SESSION_CONFLICT/.test(error.message);
        errors.set(attemptId, terminal ? "Saving stopped. Your pending work is kept on this device." : "Changes pending. Waiting to reconnect.");
        if (terminal) stopped.add(attemptId);
        const latest = await store.read(key); if (latest) notify(latest);
        if (!terminal) {
          const count = (failures.get(attemptId) ?? 0) + 1; failures.set(attemptId, count);
          // Retry backoff is independent of the normal maximum autosave delay.
          const delay = Math.max(error instanceof VisualTransportError ? error.retryAfter : 0, Math.min(30000, 1000 * 2 ** Math.min(count - 1, 5)) + Math.random() * 250);
          retryAt.set(attemptId, Date.now() + delay);
          timers.set(attemptId, setTimeout(() => { timers.delete(attemptId); void flush(attemptId); }, delay));
        }
      }
    })().catch(() => {
      // Storage reads can fail before the transport loop or while recording its acknowledgement.
      localFailures.add(attemptId);
      listeners.get(attemptId)?.forEach(listener => listener("Saving failed. Device storage is unavailable."));
    }).finally(() => sending.delete(attemptId));
    sending.set(attemptId, task); return task;
  }
  const reconnect = () => { for (const attemptId of keys.keys()) { if (!stopped.has(attemptId)) errors.delete(attemptId); if (!failures.has(attemptId)) retryAt.delete(attemptId); void flush(attemptId); } };
  const leaving = () => { for (const attemptId of keys.keys()) void flush(attemptId); };
  if (typeof window !== "undefined") { window.addEventListener("online", reconnect); window.addEventListener("pagehide", leaving); }
  const ready = store.list(options.learner).then(rows => {
    if (disposed) return;
    for (const row of rows) {
      requireVisual(row.learner === options.learner, "VISUAL_SESSION_CONFLICT");
      keys.set(row.session.attemptId, row.key);
      if (hasPendingVisualWork(row) && !row.conflict) void flush(row.session.attemptId);
    }
  }).catch(() => { /* Open/save will report storage errors; never switch to volatile Saved. */ });
  const saves = new Map<string, Promise<void>>();
  return {
    statusLabel: "Changes pending",
    subscribe(attemptId, listener) {
      const group = listeners.get(attemptId) ?? new Set(); group.add(listener); listeners.set(attemptId, group);
      const key = keys.get(attemptId); if (key) void store.read(key).then(row => { if (row && group.has(listener)) listener(label(row)); })
        .catch(() => { if (group.has(listener)) listener("Saving failed. Device storage is unavailable."); });
      return () => { group.delete(listener); if (!group.size) listeners.delete(attemptId); };
    },
    async open(activityId: string, source: VisualOrigin): Promise<OpenVisual> {
      await ready;
      const key = visualOutboxKey(options.learner, activityId);
      const cached = await store.read(key);
      if (cached) { keys.set(cached.session.attemptId, key); await flush(cached.session.attemptId); }
      const previousOpening = await store.opening(key);
      const opening = previousOpening && JSON.stringify(previousOpening.source) === JSON.stringify(source) ? previousOpening : { visitId: uuid(), source };
      await store.opening(key, opening);
      let row: VisualOutbox;
      try {
        const session = await request<VisualSession>("/api/visual-sessions/open", { activityId, ...opening });
        requireVisual(session.learner === options.learner && session.activityId === activityId, "VISUAL_SESSION_CONFLICT");
        row = await store.update(key, previous => {
          if (!previous || !hasPendingVisualWork(previous) && !previous.conflict) return initialVisualOutbox(session, previous?.writerId ?? uuid());
          requireVisual(previous.session.attemptId === session.attemptId, "VISUAL_ACTIVE_ATTEMPT_CONFLICT");
          return { ...previous, session: { ...previous.session, visitId: session.visitId } };
        });
        await store.opening(key, null);
      } catch (error) {
        // Only transport failure permits a previously authorized known attempt to continue offline.
        if (!cached || error instanceof VisualTransportError || error instanceof Error && /VISUAL_/.test(error.message)) throw error;
        row = await store.update(key, previous => {
          requireVisual(previous, "VISUAL_CONNECTION_REQUIRED");
          return { ...previous, session: { ...previous.session, visitId: opening.visitId },
            visits: previous.visits.some(v => v.visitId === opening.visitId) ? previous.visits : [...previous.visits, opening] };
        });
        await store.opening(key, null);
      }
      keys.set(row.session.attemptId, key); notify(row); if (hasPendingVisualWork(row)) schedule(row.session.attemptId);
      return { activityId, attemptId: row.session.attemptId, snapshot: structuredClone(row.snapshot) };
    },
    save(opened, snapshot, events) {
      const key = keys.get(opened.attemptId); requireVisual(key, "VISUAL_SESSION_CONFLICT");
      const task = (saves.get(opened.attemptId) ?? Promise.resolve()).catch(() => {}).then(async () => {
        try {
          const row = await store.update(key, previous => {
            requireVisual(previous && previous.learner === options.learner && previous.session.attemptId === opened.attemptId, "VISUAL_SESSION_CONFLICT");
            return enqueueVisualChange(previous, snapshot, events, uuid, new Date().toISOString());
          });
          localFailures.delete(opened.attemptId); if (!stopped.has(opened.attemptId)) errors.delete(opened.attemptId); notify(row);
          if (hasPendingVisualWork(row) && !row.conflict) schedule(opened.attemptId, events.some(e => ["stage-changed", "answer-checked", "calculation-checked", "attempt-completed"].includes(e.type)) ? 0 : 1500);
        } catch (error) {
          localFailures.add(opened.attemptId);
          listeners.get(opened.attemptId)?.forEach(listener => listener("Saving failed. Changes are not safely stored on this device.")); throw error;
        }
      });
      saves.set(opened.attemptId, task); return task;
    },
    async flush(attemptId) { await saves.get(attemptId)?.catch(() => {}); await flush(attemptId); },
    dispose() {
      disposed = true; controller.abort(); timers.forEach(clearTimeout); timers.clear(); listeners.clear();
      if (typeof window !== "undefined") { window.removeEventListener("online", reconnect); window.removeEventListener("pagehide", leaving); }
    },
  };
}

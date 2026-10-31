"use client";

import type { VisualPersistence, OpenVisual, VisualOrigin } from "../interactiveVisuals/persistence";
import { createBrowserVisualStore, type VisualOutboxStore } from "./browserStore";
import { acknowledgeVisualBatch, acknowledgeVisualRecovery, enqueueVisualChange, freezeVisualBatch, hasPendingVisualWork, initialVisualOutbox, newAttemptOutbox, upgradeVisualOutbox, visualOutboxKey,
  type VisualOutbox, type VisualSession } from "./outbox";
import { requireVisual } from "./contracts";
import type { BatchAcknowledgement, RecoveryAcknowledgement } from "./model";
import { clientId } from "../clientId";

class VisualTransportError extends Error {
  constructor(readonly status: number, readonly code: string, readonly retryAfter = 0) { super(code); }
}
type Options = Readonly<{ learner: string; store?: VisualOutboxStore; fetch?: typeof fetch; uuid?: () => string }>;
// The original account-named export remains compatible; both principal kinds
// use this one actor-bound IndexedDB, request and event/snapshot implementation.
export const createVisualPersistence = createAccountVisualPersistence;
export type VisualPersistenceClient = VisualPersistence & { dispose: () => void; settleLocal: () => Promise<void>; drain: () => Promise<void>; drainAttemptCommands: () => Promise<void> };
export function createAccountVisualPersistence(options: Options): VisualPersistenceClient {
  const store = options.store ?? createBrowserVisualStore(), send = options.fetch ?? fetch, uuid = options.uuid ?? clientId;
  const keys = new Map<string, string>(), listeners = new Map<string, Set<(status: string) => void>>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>(), sending = new Map<string, Promise<void>>();
  const errors = new Map<string, string>(), dirtySince = new Map<string, number>(), failures = new Map<string, number>();
  const retryAt = new Map<string, number>();
  const localFailures = new Map<string, string>(), stopped = new Set<string>(), generations = new Map<string, number>();
  const localPending = new Set<string>();
  const stopCodes = new Map<string, string>();
  const paused = new Set<string>(), conflicts = new Set<string>();
  const unavailable = new Set<string>();
  const controller = new AbortController(); let disposed = false;
  const label = (row: VisualOutbox) => localFailures.has(row.session.attemptId) ? localFailures.get(row.session.attemptId)!
    : row.conflict ? "Saving conflict. Your pending work is kept on this device."
    : localPending.has(row.session.attemptId) ? "Changes pending"
    : unavailable.has(row.session.attemptId) || row.session.restoration?.status === "unavailable"
      ? hasPendingVisualWork(row) ? "Interactive visual unavailable. Pending work is kept on this device." : "Interactive visual unavailable. Saved work is kept."
    : errors.get(row.session.attemptId) ?? (row.session.restoration?.status === "new-attempt-required"
      ? hasPendingVisualWork(row) ? "Previous attempt pending backup" : "Previous attempt kept"
      : hasPendingVisualWork(row) || row.snapshot === null ? "Changes pending" : "Saved");
  function notify(row: VisualOutbox) {
    const generation = generations.get(row.session.attemptId);
    if (generation !== undefined && generation !== row.generation) localFailures.set(row.session.attemptId, "Another tab changed this attempt. Reload before editing.");
    listeners.get(row.session.attemptId)?.forEach(listener => listener(label(row)));
  }
  function allowRecovery(row: VisualOutbox) {
    // A successful authorized Open may resolve a version/restore refusal. It
    // cannot clear authorization failures or a genuine stale-writer conflict.
    if (row.session.restoration?.status === "new-attempt-required"
      && ["VISUAL_RESTORATION_REQUIRED", "VISUAL_RELEASE_MISMATCH", "INVALID_VISUAL_SNAPSHOT", "INVALID_VISUAL_EVENT"].includes(stopCodes.get(row.session.attemptId) ?? "")) {
      stopped.delete(row.session.attemptId); stopCodes.delete(row.session.attemptId); errors.delete(row.session.attemptId);
    }
  }
  async function request<T>(path: string, body: unknown, method = "POST"): Promise<T> {
    requireVisual(!disposed, "VISUAL_SESSION_CLOSED");
    const abort = new AbortController(), cancel = () => abort.abort();
    controller.signal.addEventListener("abort", cancel, { once: true });
    const timeout = setTimeout(cancel, 12000);
    try {
      const response = await send(path, { method, credentials: "same-origin", cache: "no-store", signal: abort.signal,
        headers: { "Content-Type": "application/json", "X-Visual-Learner": options.learner }, ...(method === "GET" ? {} : { body: JSON.stringify(body) }) });
      const value = await response.json();
      if (!response.ok) throw new VisualTransportError(response.status, typeof value.code === "string" ? value.code : "VISUAL_REQUEST_FAILED", Number(response.headers.get("Retry-After")) * 1000 || 0);
      requireVisual(response.headers.get("X-Visual-Learner") === options.learner, "VISUAL_SESSION_CONFLICT");
      return value as T;
    } finally { clearTimeout(timeout); controller.signal.removeEventListener("abort", cancel); }
  }
  function schedule(attemptId: string, delay = 1500) {
    if (disposed || paused.has(attemptId) || stopped.has(attemptId)) return;
    const old = timers.get(attemptId); if (old) clearTimeout(old);
    const since = dirtySince.get(attemptId) ?? Date.now(); dirtySince.set(attemptId, since);
    timers.set(attemptId, setTimeout(() => { timers.delete(attemptId); void flush(attemptId); }, Math.max(0, (retryAt.get(attemptId) ?? 0) - Date.now(), Math.min(delay, 5000 - (Date.now() - since)))));
  }
  async function flush(attemptId: string): Promise<void> {
    if (disposed || paused.has(attemptId) || stopped.has(attemptId)) return;
    const scheduled = timers.get(attemptId); if (scheduled) { clearTimeout(scheduled); timers.delete(attemptId); }
    if ((retryAt.get(attemptId) ?? 0) > Date.now()) { schedule(attemptId); return; }
    const current = sending.get(attemptId); if (current) return current;
    const key = keys.get(attemptId); if (!key) return;
    const task = (async () => {
      let row = await store.read(key);
      if (!row || row.session.attemptId !== attemptId || row.conflict) return;
      try {
        while (!disposed && hasPendingVisualWork(row) && !row.conflict) {
          if (row.command) {
            const predecessor = await store.read(row.command.predecessorKey);
            requireVisual(predecessor, "VISUAL_PREDECESSOR_MISSING");
            keys.set(predecessor.session.attemptId, predecessor.key);
            if (hasPendingVisualWork(predecessor)) {
              await flush(predecessor.session.attemptId);
              const pending = await store.read(predecessor.key);
              if (pending?.conflict) {
                row = await store.update(key, latest => { requireVisual(latest, "VISUAL_SESSION_CONFLICT"); return { ...latest, conflict: true }; });
                conflicts.add(attemptId); notify(row); break;
              }
              if (stopped.has(predecessor.session.attemptId)) { stopped.add(attemptId); errors.set(attemptId, "Saving stopped. Earlier pending work is kept on this device."); notify(row); break; }
              if (!pending || hasPendingVisualWork(pending)) { schedule(attemptId, 2000); break; }
            }
            const session = await request<VisualSession>(`/api/visual-records/${row.session.recordId}/attempts`, row.command.request);
            requireVisual(session.learner === options.learner && session.attemptId === attemptId && session.attemptNumber === row.session.attemptNumber, "VISUAL_SESSION_CONFLICT");
            row = await store.update(key, latest => {
              requireVisual(latest && latest.session.attemptId === attemptId, "VISUAL_SESSION_CONFLICT");
              return { ...latest, session: { ...latest.session, nextAttemptNumber: session.nextAttemptNumber ?? latest.session.nextAttemptNumber }, command: undefined, conflict: session.activeAttemptId !== attemptId };
            });
            if (row.conflict) conflicts.add(attemptId);
            notify(row); continue;
          }
          if (row.visits.length) {
            const visit = row.visits[0];
            const session = await request<VisualSession>("/api/visual-sessions/open", { activityId: row.session.activityId, ...visit });
            requireVisual(session.learner === options.learner, "VISUAL_SESSION_CONFLICT");
            row = await store.update(key, latest => {
              requireVisual(latest && latest.session.attemptId === attemptId, "VISUAL_SESSION_CONFLICT");
              return session.attemptId === attemptId ? { ...latest, visits: latest.visits.filter(v => v.visitId !== visit.visitId),
                session: { ...latest.session, nextAttemptNumber: session.nextAttemptNumber ?? latest.session.nextAttemptNumber, restoration: session.restoration, release: session.release } } : { ...latest, conflict: true };
            });
            if (row.conflict) conflicts.add(attemptId);
            errors.delete(attemptId); failures.delete(attemptId); retryAt.delete(attemptId); notify(row); continue;
          }
          if (row.migrationCheckpoints?.length) {
            const checkpoint = row.migrationCheckpoints[0];
            const ack = await request<{ checkpointId: string; checkpointAccepted: boolean }>(`/api/visual-attempts/${attemptId}/checkpoints`, checkpoint);
            requireVisual(ack.checkpointId === checkpoint.checkpointId && ack.checkpointAccepted === true, "INVALID_VISUAL_ACKNOWLEDGEMENT");
            row = await store.update(key, latest => { requireVisual(latest && latest.session.attemptId === attemptId, "VISUAL_SESSION_CONFLICT");
              return { ...latest, migrationCheckpoints: latest.migrationCheckpoints?.filter(c => c.checkpointId !== ack.checkpointId) }; });
            notify(row); continue;
          }
          row = await store.update(key, latest => { requireVisual(latest && latest.session.attemptId === attemptId, "VISUAL_SESSION_CONFLICT"); return freezeVisualBatch(latest, uuid()); });
          if (!row.flight) break;
          const recovering = row.session.restoration?.status === "new-attempt-required";
          const ack = await request<BatchAcknowledgement | RecoveryAcknowledgement>(`/api/visual-attempts/${attemptId}/${recovering ? "recovery-batches" : "batches"}`, row.flight.batch);
          row = await store.update(key, latest => { requireVisual(latest && latest.session.attemptId === attemptId, "VISUAL_SESSION_CONFLICT");
            return recovering ? acknowledgeVisualRecovery(latest, ack as RecoveryAcknowledgement) : acknowledgeVisualBatch(latest, ack as BatchAcknowledgement); });
          if (row.conflict) conflicts.add(attemptId);
          errors.delete(attemptId); failures.delete(attemptId); retryAt.delete(attemptId); notify(row);
        }
        if (!hasPendingVisualWork(row)) { dirtySince.delete(attemptId); notify(row); }
      } catch (error) {
        if (disposed) return;
        const terminal = error instanceof VisualTransportError && [400, 401, 403, 404, 409, 413].includes(error.status)
          || error instanceof Error && /VISUAL_SESSION_CONFLICT/.test(error.message);
        errors.set(attemptId, terminal ? "Saving stopped. Your pending work is kept on this device." : "Changes pending. Waiting to reconnect.");
        if (terminal) { stopped.add(attemptId); if (error instanceof VisualTransportError) stopCodes.set(attemptId, error.code); }
        if (error instanceof VisualTransportError && ["VISUAL_UNAVAILABLE", "VISUAL_FEATURE_DISABLED"].includes(error.code)) unavailable.add(attemptId);
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
      localFailures.set(attemptId, "Saving failed. Device storage is unavailable.");
      listeners.get(attemptId)?.forEach(listener => listener("Saving failed. Device storage is unavailable."));
    }).finally(() => sending.delete(attemptId));
    sending.set(attemptId, task); return task;
  }
  const reconnect = () => { for (const attemptId of keys.keys()) { if (!stopped.has(attemptId)) errors.delete(attemptId); if (!failures.has(attemptId)) retryAt.delete(attemptId); void flush(attemptId); } };
  const leaving = () => { for (const attemptId of keys.keys()) void flush(attemptId); };
  if (typeof window !== "undefined") { window.addEventListener("online", reconnect); window.addEventListener("pagehide", leaving); }
  const ready = store.list(options.learner).then(async rows => {
    if (disposed) return;
    for (const stored of rows) {
      const row = await store.update(stored.key, previous => { requireVisual(previous, "VISUAL_SESSION_CONFLICT"); return upgradeVisualOutbox(previous, uuid); });
      requireVisual(row.learner === options.learner, "VISUAL_SESSION_CONFLICT");
      keys.set(row.session.attemptId, row.key);
      if (row.conflict) conflicts.add(row.session.attemptId);
      if (hasPendingVisualWork(row) && !row.conflict) void flush(row.session.attemptId);
    }
  }).catch(() => { /* Open/save will report storage errors; never switch to volatile Saved. */ });
  const saves = new Map<string, Promise<void>>();
  const existence = new Map<string, Promise<boolean>>();
  return {
    statusLabel: "Changes pending",
    async hasAttempt(activityId) {
      await ready; requireVisual(!disposed, "VISUAL_SESSION_CLOSED");
      // Pending/offline attempts are still attempts. Never call Open to label a preview.
      if (await store.read(visualOutboxKey(options.learner, activityId))) return true;
      const previous = existence.get(activityId); if (previous) return previous;
      const query = request<{ hasAttempt: boolean }>(`/api/visual-sessions/existing?activityId=${encodeURIComponent(activityId)}`, undefined, "GET")
        .then(value => { requireVisual(typeof value.hasAttempt === "boolean", "INVALID_VISUAL_SESSION"); return value.hasAttempt; })
        .finally(() => existence.delete(activityId));
      existence.set(activityId, query); return query;
    },
    async settleLocal() {
      await ready; await Promise.all(saves.values());
      requireVisual(!disposed && localFailures.size === 0 && localPending.size === 0, "VISUAL_CLAIM_PENDING_WORK");
    },
    async drain() {
      await ready; await Promise.all(saves.values()); requireVisual(!disposed && localFailures.size === 0 && localPending.size === 0, "VISUAL_CLAIM_PENDING_WORK");
      const rows = await store.list(options.learner);
      for (const row of rows) { requireVisual(row.learner === options.learner, "VISUAL_SESSION_CONFLICT"); keys.set(row.session.attemptId, row.key); await flush(row.session.attemptId); }
      requireVisual((await store.list(options.learner)).every(row => !hasPendingVisualWork(row) && !row.conflict) && localPending.size === 0, "VISUAL_CLAIM_PENDING_WORK");
    },
    async drainAttemptCommands() {
      await ready; await Promise.all(saves.values()); requireVisual(!disposed, "VISUAL_SESSION_CLOSED");
      const rows = await store.list(options.learner);
      for (const row of rows) if (row.command) { keys.set(row.session.attemptId, row.key); await flush(row.session.attemptId); }
      // Account ordinary pending events can be archived intact. Its already
      // confirmed attempt commands must register before claim changes the count.
      requireVisual((await store.list(options.learner)).every(row => !row.command), "VISUAL_CLAIM_PENDING_ACCOUNT_ATTEMPT");
    },
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
      if (cached) { keys.set(cached.session.attemptId, key); await saves.get(cached.session.attemptId)?.catch(() => {}); await flush(cached.session.attemptId); }
      const pending = cached ? await store.read(key) : undefined;
      if (pending?.command) {
        // This attempt already has a durable command on a known record. Until it is
        // registered, a normal server Open would still return its predecessor.
        const visit = { visitId: uuid(), source };
        const row = await store.update(key, previous => { requireVisual(previous, "VISUAL_CONNECTION_REQUIRED");
          return { ...previous, source, session: { ...previous.session, visitId: visit.visitId }, visits: [...previous.visits, visit] }; });
        keys.set(row.session.attemptId, key); generations.set(row.session.attemptId, row.generation); notify(row); schedule(row.session.attemptId);
        return { activityId, attemptId: row.session.attemptId, attemptNumber: row.session.attemptNumber, visitId: row.session.visitId, snapshot: structuredClone(row.snapshot), restoration: row.session.restoration };
      }
      const previousOpening = await store.opening(key);
      const opening = previousOpening && JSON.stringify(previousOpening.source) === JSON.stringify(source) ? previousOpening : { visitId: uuid(), source };
      await store.opening(key, opening);
      let row: VisualOutbox;
      try {
        const session = await request<VisualSession>("/api/visual-sessions/open", { activityId, ...opening });
        requireVisual(session.learner === options.learner && session.activityId === activityId, "VISUAL_SESSION_CONFLICT");
        row = await store.update(key, previous => {
          const incoming = initialVisualOutbox(session, previous?.writerId ?? uuid(), source);
          if (!previous || !hasPendingVisualWork(previous) && !previous.conflict) {
            // A clean local copy can still help recover from server corruption. Retain
            // it in the archived row when recovery is confirmed, without executing it.
            return previous && previous.session.attemptId === session.attemptId && session.restoration?.status === "new-attempt-required"
              ? { ...previous, source, session: incoming.session } : previous
                ? { ...incoming, generation: previous.generation + 1, savedGeneration: previous.generation + 1 } : incoming;
          }
          if (previous.session.attemptId !== session.attemptId) return { ...previous, conflict: true };
          return { ...previous, source, session: { ...previous.session, nextAttemptNumber: session.nextAttemptNumber ?? previous.session.nextAttemptNumber, visitId: session.visitId, restoration: session.restoration, release: session.release } };
        });
        await store.opening(key, null);
      } catch (error) {
        // Only transport failure permits a previously authorized known attempt to continue offline.
        if (!cached || error instanceof VisualTransportError || error instanceof Error && /VISUAL_/.test(error.message)) throw error;
        row = await store.update(key, previous => {
          requireVisual(previous, "VISUAL_CONNECTION_REQUIRED");
          return { ...previous, source, session: { ...previous.session, visitId: opening.visitId },
            visits: previous.visits.some(v => v.visitId === opening.visitId) ? previous.visits : [...previous.visits, opening] };
        });
        await store.opening(key, null);
      }
      allowRecovery(row);
      keys.set(row.session.attemptId, key); generations.set(row.session.attemptId, row.generation); if (row.conflict) conflicts.add(row.session.attemptId); notify(row); if (hasPendingVisualWork(row)) schedule(row.session.attemptId);
      return { activityId, attemptId: row.session.attemptId, attemptNumber: row.session.attemptNumber, visitId: row.session.visitId,
        snapshot: row.session.restoration && row.session.restoration.status !== "ready" ? null : structuredClone(row.snapshot), restoration: row.session.restoration };
    },
    save(opened, snapshot, events) {
      const key = keys.get(opened.attemptId); requireVisual(key, "VISUAL_SESSION_CONFLICT");
      localPending.add(opened.attemptId);
      listeners.get(opened.attemptId)?.forEach(listener => listener(localFailures.get(opened.attemptId)
        ?? (conflicts.has(opened.attemptId) ? "Saving conflict. Your pending work is kept on this device." : "Changes pending")));
      const task = (saves.get(opened.attemptId) ?? Promise.resolve()).catch(() => {}).then(async () => {
        try {
          const row = await store.update(key, previous => {
            requireVisual(previous && previous.learner === options.learner && previous.session.attemptId === opened.attemptId, "VISUAL_SESSION_CONFLICT");
            requireVisual(previous.generation === generations.get(opened.attemptId), "VISUAL_LOCAL_REVISION_CONFLICT");
            return enqueueVisualChange(previous, snapshot, events, uuid, new Date().toISOString(), opened.visitId);
          });
          generations.set(opened.attemptId, row.generation);
          if (saves.get(opened.attemptId) === task) localPending.delete(opened.attemptId);
          localFailures.delete(opened.attemptId); if (!stopped.has(opened.attemptId)) errors.delete(opened.attemptId); notify(row);
          if (hasPendingVisualWork(row) && !row.conflict) schedule(opened.attemptId, events.some(e => ["stage-changed", "answer-checked", "calculation-checked", "attempt-completed"].includes(e.type)) ? 0 : 1500);
        } catch (error) {
          if (saves.get(opened.attemptId) === task) localPending.delete(opened.attemptId);
          const message = error instanceof Error && error.message === "VISUAL_LOCAL_REVISION_CONFLICT"
            ? "Another tab changed this attempt. These changes are not safely stored."
            : "Saving failed. Changes are not safely stored on this device.";
          localFailures.set(opened.attemptId, message);
          listeners.get(opened.attemptId)?.forEach(listener => listener(message)); throw error;
        }
      });
      saves.set(opened.attemptId, task); return task;
    },
    async flush(attemptId) { await saves.get(attemptId)?.catch(() => {}); await flush(attemptId); },
    canStartNewAttempt: attemptId => !conflicts.has(attemptId) && !stopped.has(attemptId) && !localFailures.has(attemptId),
    isAvailable: attemptId => !unavailable.has(attemptId),
    async startNewAttempt(opened) {
      const key = keys.get(opened.attemptId); requireVisual(key === visualOutboxKey(options.learner, opened.activityId)
        && !conflicts.has(opened.attemptId) && !stopped.has(opened.attemptId), "VISUAL_ACTIVE_ATTEMPT_CONFLICT");
      await saves.get(opened.attemptId);
      paused.add(opened.attemptId);
      try {
        await sending.get(opened.attemptId);
        const row = await store.transition(key, opened.attemptId, previous => {
          requireVisual(previous.generation === generations.get(opened.attemptId), "VISUAL_LOCAL_REVISION_CONFLICT");
          return newAttemptOutbox(previous, { attemptId: uuid(), commandId: uuid(), visitId: uuid(), writerId: uuid() });
        });
        keys.set(opened.attemptId, row.command!.predecessorKey); keys.set(row.session.attemptId, key);
        generations.set(row.session.attemptId, row.generation);
        schedule(row.session.attemptId, 0);
        return { activityId: row.session.activityId, attemptId: row.session.attemptId, attemptNumber: row.session.attemptNumber, visitId: row.session.visitId, snapshot: null };
      } finally { paused.delete(opened.attemptId); }
    },
    dispose() {
      disposed = true; controller.abort(); timers.forEach(clearTimeout); timers.clear(); listeners.clear();
      if (typeof window !== "undefined") { window.removeEventListener("online", reconnect); window.removeEventListener("pagehide", leaving); }
    },
  };
}

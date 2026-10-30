import type { VisualHostEvent } from "../../app/step-visuals/core/host";
import { getInteractiveVisual } from "../interactiveVisuals/catalogue";
import type { InteractiveVisualRelease } from "../interactiveVisuals/catalogue";
import type { VisualRestoration } from "../interactiveVisuals/persistence";
import { assertBoundedJson, assertUuid, assertVisualBatch, assertVisualSnapshot, requireVisual, safeCount } from "./contracts";
import type { BatchAcknowledgement, NewVisualAttempt, VisualBatch, VisualEventInput, VisualSnapshot, VisualSource } from "./model";

export type VisualSession = Readonly<{
  learner: string; recordId: string; activityId: string; activeAttemptId: string;
  attemptId: string; attemptNumber: number; stateRevision: number;
  activityVersion: number; snapshotSchema: number; snapshot: VisualSnapshot | null; visitId: string;
  release?: InteractiveVisualRelease; restoration?: VisualRestoration;
}>;
export type PendingVisualVisit = Readonly<{ visitId: string; source: VisualSource }>;
type QueuedEvent = VisualEventInput & Readonly<{ visitId: string }>;
export type VisualOutbox = Readonly<{
  key: string; learner: string; session: VisualSession; writerId: string;
  snapshot: VisualSnapshot | null; generation: number; savedGeneration: number; throughSequence: number;
  events: readonly QueuedEvent[]; visits: readonly PendingVisualVisit[];
  flight: Readonly<{ batch: VisualBatch; generation: number }> | null;
  conflict: boolean;
  source?: VisualSource;
  command?: Readonly<{ request: NewVisualAttempt; predecessorKey: string }>;
}>;
export const visualOutboxKey = (learner: string, activityId: string) => `${learner}|${activityId}`;
export function initialVisualOutbox(session: VisualSession, writerId: string, source: VisualSource = { kind: "direct" }): VisualOutbox {
  assertUuid(session.recordId); assertUuid(session.attemptId); assertUuid(session.activeAttemptId); assertUuid(session.visitId); assertUuid(writerId);
  requireVisual(safeCount(session.attemptNumber) && session.attemptNumber > 0 && safeCount(session.stateRevision), "INVALID_VISUAL_SESSION");
  const release = getInteractiveVisual(session.activityId);
  requireVisual(release && (!session.release || release.id === session.release.id && release.activityVersion === session.release.activityVersion && release.snapshotSchema === session.release.snapshotSchema), "VISUAL_RELEASE_MISMATCH");
  const recovering = session.restoration && session.restoration.status !== "ready";
  requireVisual(recovering || release.activityVersion === session.activityVersion && release.snapshotSchema === session.snapshotSchema, "VISUAL_RELEASE_MISMATCH");
  if (recovering) session = { ...session, snapshot: null, activityVersion: release.activityVersion, snapshotSchema: release.snapshotSchema };
  else if (session.snapshot !== null) {
    assertVisualSnapshot(session.snapshot, session.activityId, session.attemptId);
    requireVisual(session.snapshot.attemptNumber === session.attemptNumber, "INVALID_VISUAL_SESSION");
  }
  return { key: visualOutboxKey(session.learner, session.activityId), learner: session.learner, session, writerId,
    snapshot: session.snapshot, generation: 0, savedGeneration: 0, throughSequence: session.snapshot?.sequence ?? 0,
    events: [], visits: [], flight: null, conflict: false, source };
}
export const hasPendingVisualWork = (row: VisualOutbox) => row.generation !== row.savedGeneration || row.events.length > 0 || !!row.flight || row.visits.length > 0 || !!row.command;
export function newAttemptOutbox(previous: VisualOutbox, ids: { attemptId: string; commandId: string; visitId: string; writerId: string }): VisualOutbox {
  requireVisual(!previous.conflict, "VISUAL_ACTIVE_ATTEMPT_CONFLICT");
  const session: VisualSession = { ...previous.session, attemptId: ids.attemptId, activeAttemptId: ids.attemptId,
    attemptNumber: previous.session.attemptNumber + 1, snapshot: null, stateRevision: 0, visitId: ids.visitId, restoration: { status: "ready" } };
  const source = previous.source ?? { kind: "direct" as const };
  return { ...initialVisualOutbox(session, ids.writerId, source), visits: [{ visitId: ids.visitId, source }],
    command: { request: { commandId: ids.commandId, attemptId: ids.attemptId, expectedActiveAttemptId: previous.session.attemptId },
      predecessorKey: `${previous.key}|${previous.session.attemptId}` } };
}

/** All UUID/timestamp allocation happens inside the same local transaction as its snapshot. */
export function enqueueVisualChange(row: VisualOutbox, snapshot: unknown, events: readonly VisualHostEvent[], uuid: () => string, now: string, visitId = row.session.visitId): VisualOutbox {
  assertVisualSnapshot(snapshot, row.session.activityId, row.session.attemptId);
  requireVisual(snapshot.attemptNumber === row.session.attemptNumber && snapshot.sequence >= row.throughSequence, "VISUAL_SEQUENCE_REGRESSION");
  const release = getInteractiveVisual(row.session.activityId)!;
  const additions: QueuedEvent[] = [];
  let through = row.throughSequence;
  for (const event of events) {
    requireVisual(event.sequence <= snapshot.sequence, "INVALID_VISUAL_EVENT");
    if (event.sequence <= through) continue; // Strict-effect replay or a previously queued delivery buffer.
    requireVisual(event.sequence === through + 1, "VISUAL_EVENT_SEQUENCE_GAP");
    additions.push({ eventId: uuid(), writerId: row.writerId, clientSequence: event.sequence, clientOccurredAt: now,
      activityVersion: release.activityVersion, eventSchema: release.eventSchema, type: event.type,
      payload: structuredClone(event) as unknown as Record<string, unknown>, visitId });
    through = event.sequence;
  }
  requireVisual(snapshot.sequence === through, "VISUAL_EVENT_SEQUENCE_GAP");
  // Repeated hydration/effects with the identical snapshot do not create an unsavable dirty generation.
  if (additions.length === 0 && JSON.stringify(snapshot) === JSON.stringify(row.snapshot)) return row;
  const next = { ...row, snapshot: structuredClone(snapshot), generation: row.generation + 1, throughSequence: through, events: [...row.events, ...additions] };
  // Validate one-event envelopes now, before claiming local durable acceptance.
  for (const event of additions) {
    const { visitId, ...input } = event;
    assertVisualBatch({ writeId: event.eventId, expectedStateRevision: row.session.stateRevision, visitId,
      activityVersion: release.activityVersion, snapshotSchema: release.snapshotSchema, events: [input], snapshot }, release.id, row.session.attemptId);
  }
  return next;
}
export function freezeVisualBatch(row: VisualOutbox, writeId: string): VisualOutbox {
  if (row.flight || row.conflict || row.command || !hasPendingVisualWork(row) || !row.snapshot || row.visits.length) return row;
  const visitId = row.events[0]?.visitId ?? row.session.visitId;
  let selected = row.events.filter(e => e.visitId === visitId).slice(0, 100).map(e => ({ eventId: e.eventId, writerId: e.writerId,
    clientSequence: e.clientSequence, clientOccurredAt: e.clientOccurredAt, activityVersion: e.activityVersion, eventSchema: e.eventSchema, type: e.type, payload: e.payload }));
  let batch: VisualBatch;
  while (true) {
    batch = { writeId, expectedStateRevision: row.session.stateRevision, visitId, activityVersion: row.session.activityVersion,
      snapshotSchema: row.session.snapshotSchema, snapshot: row.snapshot, events: selected };
    try { assertBoundedJson(batch); break; }
    catch (error) { if (selected.length <= 1) throw error; selected = selected.slice(0, Math.ceil(selected.length / 2)); }
  }
  return { ...row, flight: { batch, generation: row.generation } };
}
export function acknowledgeVisualBatch(row: VisualOutbox, ack: BatchAcknowledgement): VisualOutbox {
  const flight = row.flight;
  requireVisual(flight && ack.writeId === flight.batch.writeId && Number.isSafeInteger(ack.stateRevision)
    && ack.stateRevision >= row.session.stateRevision && (!ack.snapshotAccepted || ack.stateRevision > flight.batch.expectedStateRevision)
    && ack.conflict === !ack.snapshotAccepted, "INVALID_VISUAL_ACKNOWLEDGEMENT");
  const ids = new Set(flight.batch.events.map(e => e.eventId));
  requireVisual(ack.acceptedEventIds.length === ids.size && ack.acceptedEventIds.every(id => ids.has(id))
    && new Set(ack.acceptedEventIds).size === ids.size, "INVALID_VISUAL_ACKNOWLEDGEMENT");
  return { ...row, events: row.events.filter(e => !ids.has(e.eventId)),
    session: { ...row.session, stateRevision: ack.stateRevision },
    savedGeneration: ack.snapshotAccepted ? flight.generation : row.savedGeneration,
    flight: ack.snapshotAccepted ? null : flight, conflict: !ack.snapshotAccepted };
}

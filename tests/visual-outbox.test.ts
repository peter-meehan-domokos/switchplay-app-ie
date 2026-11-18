import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { acknowledgeVisualBatch, enqueueVisualChange, freezeVisualBatch, hasPendingVisualWork, initialVisualOutbox, newAttemptOutbox, type VisualSession } from "../src/lib/visualLearningRecords/outbox";
import { createRootsHostedState, reduceRootsHostedState, rootsSnapshot } from "../src/app/step-visuals/activities/roots-factors/hostState";

const session = (): VisualSession => ({ learner: "account:one", recordId: randomUUID(), activityId: "roots-and-factors", activeAttemptId: randomUUID(),
  attemptId: randomUUID(), attemptNumber: 1, stateRevision: 0, activityVersion: 1, snapshotSchema: 1, snapshot: null, visitId: randomUUID() });
const date = "2026-10-30T12:00:00.000Z";
test("future attempt allocation follows the merged record without renumbering historical snapshots and supports old stored sessions", () => {
  const opened = { ...session(), nextAttemptNumber: 9 }, old = initialVisualOutbox(opened, randomUUID());
  const ids = () => ({ attemptId: randomUUID(), commandId: randomUUID(), writerId: randomUUID(), visitId: randomUUID() });
  const next = newAttemptOutbox(old, ids()), offlineNext = newAttemptOutbox(next, ids());
  assert.equal(next.session.attemptNumber, 9); assert.equal(offlineNext.session.attemptNumber, 10); assert.equal(old.session.attemptNumber, 1);
  assert.equal(newAttemptOutbox(initialVisualOutbox(session(), randomUUID()), ids()).session.attemptNumber, 2);
  assert.throws(() => initialVisualOutbox({ ...opened, nextAttemptNumber: 1 }, randomUUID()), /INVALID_VISUAL_SESSION/);
});
test("strict effects deduplicate local events while newer state remains pending after an older acknowledgement", () => {
  const opened = session(), state = createRootsHostedState(opened.attemptId), snapshot = rootsSnapshot(state);
  let row = enqueueVisualChange(initialVisualOutbox(opened, randomUUID()), snapshot, state.recorded.records.events, randomUUID, date);
  const repeated = enqueueVisualChange(row, snapshot, state.recorded.records.events, randomUUID, date);
  assert.deepEqual(row, repeated); assert.equal(row.events.length, 1);
  row = freezeVisualBatch(row, randomUUID()); const flight = row.flight!;
  const next = reduceRootsHostedState(state, { type: "root", action: { type: "place", root: 4, revision: 0 } });
  row = enqueueVisualChange(row, rootsSnapshot(next), next.recorded.records.events, randomUUID, date);
  assert.deepEqual(row.flight, flight);
  row = acknowledgeVisualBatch(row, { writeId: flight.batch.writeId, acceptedEventIds: flight.batch.events.map(e => e.eventId), snapshotAccepted: true, conflict: false, stateRevision: 1 });
  assert.equal(hasPendingVisualWork(row), true); assert.equal(row.events.length, 1); assert.equal(row.savedGeneration, 1); assert.equal(row.generation, 2);
  row = freezeVisualBatch(row, randomUUID());
  assert.equal(row.flight!.batch.expectedStateRevision, 1);
  row = acknowledgeVisualBatch(row, { writeId: row.flight!.batch.writeId, acceptedEventIds: row.events.map(e => e.eventId), snapshotAccepted: true, conflict: false, stateRevision: 2 });
  assert.equal(hasPendingVisualWork(row), false);
});
test("a conflict retains the exact candidate and frozen request while acknowledging stored events", () => {
  const opened = session(), state = createRootsHostedState(opened.attemptId);
  let row = freezeVisualBatch(enqueueVisualChange(initialVisualOutbox(opened, randomUUID()), rootsSnapshot(state), state.recorded.records.events, randomUUID, date), randomUUID());
  const flight = row.flight;
  row = acknowledgeVisualBatch(row, { writeId: flight!.batch.writeId, acceptedEventIds: row.events.map(e => e.eventId), snapshotAccepted: false, conflict: true, stateRevision: 7 });
  assert.equal(row.conflict, true); assert.equal(hasPendingVisualWork(row), true); assert.equal(row.events.length, 0);
  assert.deepEqual(row.flight, flight); assert.deepEqual(row.snapshot, rootsSnapshot(state));
  assert.equal(freezeVisualBatch(row, randomUUID()), row);
});
test("large offline event queues split into bounded requests without deleting history", () => {
  const opened = session(); let state = createRootsHostedState(opened.attemptId);
  for (let i = 0; i < 250; i++) state = reduceRootsHostedState(state, { type: "root", action: { type: "place", root: i % 2 ? 3 : 4, revision: state.recorded.learning.manipulation.revision } });
  let row = enqueueVisualChange(initialVisualOutbox(opened, randomUUID()), rootsSnapshot(state), state.recorded.records.events, randomUUID, date);
  const all = row.events.map(e => e.eventId), saved: string[] = []; let revision = 0;
  while (hasPendingVisualWork(row)) {
    row = freezeVisualBatch(row, randomUUID()); const flight = row.flight!;
    assert.ok(flight.batch.events.length <= 100); saved.push(...flight.batch.events.map(e => e.eventId));
    row = acknowledgeVisualBatch(row, { writeId: flight.batch.writeId, acceptedEventIds: flight.batch.events.map(e => e.eventId), snapshotAccepted: true, conflict: false, stateRevision: ++revision });
  }
  assert.deepEqual(saved, all); assert.equal(saved.length, 251); assert.equal(new Set(saved).size, 251);
});
test("malformed acknowledgements or event gaps cannot create Saved state", () => {
  const opened = session(), state = createRootsHostedState(opened.attemptId);
  const row = freezeVisualBatch(enqueueVisualChange(initialVisualOutbox(opened, randomUUID()), rootsSnapshot(state), state.recorded.records.events, randomUUID, date), randomUUID());
  assert.throws(() => acknowledgeVisualBatch(row, { writeId: row.flight!.batch.writeId, acceptedEventIds: [], snapshotAccepted: true, conflict: false, stateRevision: 1 }), /ACKNOWLEDGEMENT/);
  assert.throws(() => acknowledgeVisualBatch(row, { writeId: row.flight!.batch.writeId, acceptedEventIds: row.events.map(e => e.eventId), snapshotAccepted: true, conflict: false, stateRevision: 0 }), /ACKNOWLEDGEMENT/);
  assert.throws(() => enqueueVisualChange(initialVisualOutbox(opened, randomUUID()), { ...rootsSnapshot(state), sequence: 2 }, [{ ...state.recorded.records.events[0], sequence: 2 }], randomUUID, date), /SEQUENCE_GAP/);
});

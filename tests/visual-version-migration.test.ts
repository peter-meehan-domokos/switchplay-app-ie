import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createRootsHostedState, reduceRootsHostedState, rootsSnapshot } from "../src/app/step-visuals/activities/roots-factors/hostState";
import { assertVisualBatch } from "../src/lib/visualLearningRecords/contracts";
import { convertVisualSnapshot } from "../src/lib/visualLearningRecords/migrations";
import { acknowledgeVisualBatch, acknowledgeVisualRecovery, enqueueVisualChange, freezeVisualBatch, hasPendingVisualWork, initialVisualOutbox, newAttemptOutbox, upgradeVisualOutbox, type VisualSession } from "../src/lib/visualLearningRecords/outbox";
import { rootsMigration, testVersions } from "./helpers/visual-versions";

function fixture() {
  const attemptId = randomUUID(), state = createRootsHostedState(attemptId);
  const session: VisualSession = { learner: "account:one", recordId: randomUUID(), activityId: "roots-and-factors", activeAttemptId: attemptId,
    attemptId, attemptNumber: 1, stateRevision: 0, activityVersion: 1, snapshotSchema: 1, snapshot: null, visitId: randomUUID() };
  const row = freezeVisualBatch(enqueueVisualChange(initialVisualOutbox(session, randomUUID()), rootsSnapshot(state), state.recorded.records.events, randomUUID,
    "2026-10-30T12:00:00.000Z"), randomUUID());
  return { state, row };
}
test("activity conversion must validate both formats and preserve attempt identity and sequence", () => {
  const { row } = fixture(), old = { ...row.snapshot!, activityVersion: 0 };
  const converted = convertVisualSnapshot(old, rootsMigration, row.session.attemptId, testVersions.codecs);
  assert.deepEqual(converted, row.snapshot); assert.equal(old.activityVersion, 0);
  for (const convert of [() => ({ ...old, activityVersion: 1, attemptId: randomUUID() }),
    () => ({ ...old, activityVersion: 1, sequence: old.sequence + 1 }),
    () => ({ ...old, activityVersion: 1, attemptNumber: 2 }), () => ({ invalid: true })]) {
    assert.throws(() => convertVisualSnapshot(old, { ...rootsMigration, convert }, row.session.attemptId, testVersions.codecs));
  }
  assert.throws(() => convertVisualSnapshot(old, rootsMigration, row.session.attemptId), /CODEC_MISSING/);
});
test("local conversion checkpoints the candidate while preserving frozen requests and old event identities", () => {
  const { row: current, state } = fixture();
  const legacyEvent = { ...current.events[0], activityVersion: 0, payload: { ...current.events[0].payload, activityVersion: 0 } };
  const oldSnapshot = { ...current.snapshot!, activityVersion: 0 };
  const old = { ...current, snapshot: oldSnapshot, session: { ...current.session, activityVersion: 0, snapshot: oldSnapshot }, events: [legacyEvent],
    flight: { ...current.flight!, batch: { ...current.flight!.batch, activityVersion: 0, snapshot: oldSnapshot, events: [legacyEvent] } } };
  const bytes = JSON.stringify(old.flight);
  let upgraded = upgradeVisualOutbox(old, randomUUID, testVersions);
  assert.equal(JSON.stringify(upgraded.flight), bytes); assert.deepEqual(upgraded.events, old.events);
  assert.equal(upgraded.generation, old.generation + 1); assert.equal(upgraded.session.activityVersion, 1);
  assert.deepEqual(upgraded.snapshot, current.snapshot); assert.deepEqual(upgraded.migrationCheckpoints![0].snapshot, oldSnapshot);
  assert.equal(upgradeVisualOutbox(upgraded, randomUUID, testVersions), upgraded);
  const moved = reduceRootsHostedState(state, { type: "root", action: { type: "place", root: 4, revision: 0 } });
  upgraded = enqueueVisualChange(upgraded, rootsSnapshot(moved), moved.recorded.records.events, randomUUID, "2026-10-30T12:00:01.000Z");
  upgraded = acknowledgeVisualBatch(upgraded, { writeId: old.flight.batch.writeId, acceptedEventIds: [legacyEvent.eventId], snapshotAccepted: true, stateRevision: 1, conflict: false });
  assert.equal(hasPendingVisualWork(upgraded), true); assert.equal(upgraded.events[0].activityVersion, 1);
  upgraded = { ...upgraded, migrationCheckpoints: [] };
  upgraded = freezeVisualBatch(upgraded, randomUUID());
  assertVisualBatch(upgraded.flight!.batch, "roots-and-factors", old.session.attemptId, testVersions.codecs);
  assert.equal(upgraded.flight!.batch.activityVersion, 1);
});
test("mixed known release events remain valid without retagging historical facts", () => {
  const { row } = fixture();
  const event = { ...row.flight!.batch.events[0], activityVersion: 0, payload: { ...row.events[0].payload, activityVersion: 0 } };
  assert.doesNotThrow(() => assertVisualBatch({ ...row.flight!.batch, events: [event] }, "roots-and-factors", row.session.attemptId, testVersions.codecs));
  assert.throws(() => assertVisualBatch({ ...row.flight!.batch, events: [{ ...event, clientSequence: 2 }] }, "roots-and-factors", row.session.attemptId, testVersions.codecs));
});
test("recovery acknowledgement preserves the raw candidate, clears only backed up work and does not install a resumable snapshot", () => {
  const { row } = fixture(), recovering = { ...row, session: { ...row.session, restoration: { status: "new-attempt-required" as const, reason: "invalid-state" as const,
    storedActivityVersion: 1, storedSnapshotSchema: 1 } } };
  const ack = { writeId: row.flight!.batch.writeId, acceptedEventIds: row.events.map(e => e.eventId), checkpointAccepted: true as const, validation: "known-codec" as const };
  const saved = acknowledgeVisualRecovery(recovering, ack);
  assert.equal(hasPendingVisualWork(saved), false); assert.equal(saved.session.stateRevision, 0);
  assert.equal(saved.session.restoration?.status, "new-attempt-required"); assert.deepEqual(saved.snapshot, row.snapshot);
  assert.throws(() => acknowledgeVisualRecovery(recovering, { ...ack, acceptedEventIds: [] }), /ACKNOWLEDGEMENT/);
  assert.throws(() => acknowledgeVisualRecovery(row, ack), /ACKNOWLEDGEMENT/);
  const next = newAttemptOutbox({ ...saved, session: { ...saved.session, activityVersion: 0 } },
    { attemptId: randomUUID(), commandId: randomUUID(), visitId: randomUUID(), writerId: randomUUID() });
  assert.equal(next.session.activityVersion, 1); assert.equal(next.session.attemptNumber, 2);
});

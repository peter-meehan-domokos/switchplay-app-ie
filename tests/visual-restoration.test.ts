import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { inspectVisualRestoration } from "../src/lib/visualLearningRecords/restoration";
import { getInteractiveVisual } from "../src/lib/interactiveVisuals/catalogue";
import { createRootsHostedState, rootsSnapshot } from "../src/app/step-visuals/activities/roots-factors/hostState";
import type { VisualAttempt } from "../src/lib/visualLearningRecords/model";
import { initialVisualOutbox } from "../src/lib/visualLearningRecords/outbox";

function fixture(): VisualAttempt {
  const attemptId = randomUUID(); return { attemptId, recordId: randomUUID(), activityId: "roots-and-factors", attemptNumber: 1,
    startedRelease: 1, activityVersion: 1, snapshotSchema: 1, snapshot: rootsSnapshot(createRootsHostedState(attemptId)),
    stateRevision: 1, lastAcceptedWrite: null, createdAt: new Date(), updatedAt: new Date() };
}
test("validated current and legacy optional-field snapshots remain restorable without changing historical data", () => {
  const attempt = fixture(), release = getInteractiveVisual(attempt.activityId)!;
  assert.deepEqual(inspectVisualRestoration(attempt, release), { status: "ready" });
  const legacy = Object.fromEntries(Object.entries(attempt.snapshot!).filter(([key]) => key !== "attemptEvidence"));
  assert.deepEqual(inspectVisualRestoration({ ...attempt, snapshot: legacy as unknown as VisualAttempt["snapshot"] }, release), { status: "ready" });
  assert.deepEqual(inspectVisualRestoration(attempt, { ...release, status: "retired" }), { status: "ready" });
  assert.equal(attempt.stateRevision, 1);
});
test("unknown releases, schema mismatch, corrupt state and wrong identity require safe recovery", () => {
  const attempt = fixture(), release = getInteractiveVisual(attempt.activityId)!;
  assert.deepEqual(inspectVisualRestoration(attempt, undefined), { status: "unavailable" });
  for (const [changed, reason] of [
    [{ ...attempt, activityVersion: 0 }, "version"], [{ ...attempt, snapshotSchema: 9 }, "schema"],
    [{ ...attempt, snapshot: { wrong: true } }, "invalid-state"],
    [{ ...attempt, snapshot: { ...attempt.snapshot, attemptId: randomUUID() } }, "invalid-state"],
    [{ ...attempt, snapshot: { ...attempt.snapshot, attemptNumber: 2 } }, "invalid-state"],
  ] as const) {
    const before = structuredClone(changed);
    const result = inspectVisualRestoration(changed as VisualAttempt, release);
    assert.equal(result.status, "new-attempt-required"); if (result.status === "new-attempt-required") assert.equal(result.reason, reason);
    assert.deepEqual(changed, before);
  }
});
test("a matching client can present recovery without hydrating unsafe state; an older client cannot execute a newer release", () => {
  const attempt = fixture(), release = getInteractiveVisual(attempt.activityId)!;
  const session = { learner: "account:one", recordId: attempt.recordId, activityId: attempt.activityId, activeAttemptId: attempt.attemptId,
    attemptId: attempt.attemptId, attemptNumber: 1, stateRevision: 1, activityVersion: 0, snapshotSchema: 0, snapshot: null,
    visitId: randomUUID(), release, restoration: { status: "new-attempt-required" as const, reason: "version" as const, storedActivityVersion: 0, storedSnapshotSchema: 0 } };
  const row = initialVisualOutbox(session, randomUUID()); assert.equal(row.snapshot, null); assert.equal(row.session.activityVersion, 1);
  assert.throws(() => initialVisualOutbox({ ...session, release: { ...release, activityVersion: 2 } }, randomUUID()), /VISUAL_RELEASE_MISMATCH/);
});

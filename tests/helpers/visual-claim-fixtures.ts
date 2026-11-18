import { createRootsHostedState, reduceRootsHostedState, rootsSnapshot } from "../../src/app/step-visuals/activities/roots-factors/hostState";
import { initialVisualOutbox, enqueueVisualChange, freezeVisualBatch, visualOutboxKey } from "../../src/lib/visualLearningRecords/outbox";
import type { VisualClaimJournal } from "../../src/lib/visualLearningRecords/claimOutbox";
import type { VisualClaimReceipt } from "../../src/lib/visualLearningRecords/model";

export function claimFixture() {
  const uuid = () => crypto.randomUUID(), guestLearner = `guest:${uuid()}`, accountLearner = "account:alice";
  const guestRecord = uuid(), accountRecord = uuid(), guestAttempt = uuid(), accountAttempt = uuid();
  const state = createRootsHostedState(accountAttempt), guestState = reduceRootsHostedState(createRootsHostedState(guestAttempt), { type: "root", action: { type: "place", root: 4, revision: 0 } });
  const session = (learner: string, recordId: string, attemptId: string, snapshot: ReturnType<typeof rootsSnapshot>) => ({ learner, recordId, attemptId, activeAttemptId: attemptId,
    activityId: "roots-and-factors", attemptNumber: 1, stateRevision: 1, activityVersion: 1, snapshotSchema: 1, snapshot, visitId: uuid() });
  const account = initialVisualOutbox(session(accountLearner, accountRecord, accountAttempt, rootsSnapshot(state)), uuid());
  const changed = reduceRootsHostedState(state, { type: "root", action: { type: "place", root: 5, revision: 0 } });
  const pending = freezeVisualBatch(enqueueVisualChange(account, rootsSnapshot(changed), changed.recorded.records.events, uuid, "2026-10-30T12:00:00.000Z"), uuid());
  const guest = initialVisualOutbox(session(guestLearner, guestRecord, guestAttempt, rootsSnapshot(guestState)), uuid());
  const journal: VisualClaimJournal = { claimId: uuid(), guestLearner, accountLearner, activityId: "roots-and-factors", foregroundAttemptId: guestAttempt,
    createdAt: "2026-10-30T12:00:00.000Z", phase: "prepared" };
  const receipt: VisualClaimReceipt = { claimId: journal.claimId, learner: accountLearner, guestLearner, foregroundAttemptId: guestAttempt,
    mappings: [{ activityId: "roots-and-factors", guestRecordId: guestRecord, recordId: accountRecord, guestActiveAttemptId: guestAttempt, activeAttemptId: guestAttempt, nextAttemptNumber: 3 }] };
  return { guest, account, pending, journal, receipt, uuid, accountKey: visualOutboxKey(accountLearner, "roots-and-factors") };
}

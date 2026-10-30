import { test } from "node:test";
import assert from "node:assert/strict";
import { planVisualClaimInstall, assertVisualClaimReceipt } from "../src/lib/visualLearningRecords/claimOutbox";
import { newAttemptOutbox } from "../src/lib/visualLearningRecords/outbox";
import { claimFixture } from "./helpers/visual-claim-fixtures";

test("claim archives the exact pending account batch and moves clean guest state without changing meaningful IDs or snapshots", () => {
  const f = claimFixture(), before = JSON.stringify(f), plan = planVisualClaimInstall(f.journal, f.receipt, [f.guest], [f.pending]);
  const archived = plan.puts.find(row => row.key === `${f.accountKey}|${f.account.session.attemptId}`)!, current = plan.puts.find(row => row.key === f.accountKey)!;
  assert.deepEqual(archived, { ...f.pending, key: archived.key }); assert.deepEqual(archived.flight, f.pending.flight);
  assert.equal(current.session.attemptId, f.guest.session.attemptId); assert.deepEqual(current.snapshot, f.guest.snapshot);
  assert.equal(current.learner, f.receipt.learner); assert.equal(current.session.recordId, f.account.session.recordId); assert.equal(current.session.nextAttemptNumber, 3);
  assert.ok(plan.deletes.includes(f.guest.key)); assert.equal(plan.journal.phase, "installed"); assert.equal(JSON.stringify(f), before);
});
test("missing local guest bytes still archive pending account work before server restoration, without inventing an executable snapshot", () => {
  const f = claimFixture(), plan = planVisualClaimInstall(f.journal, f.receipt, [], [f.pending]);
  assert.ok(plan.deletes.includes(f.accountKey)); assert.equal(plan.puts.length, 1); assert.deepEqual(plan.puts[0].snapshot, f.pending.snapshot);
});
test("unregistered account attempts, dirty guest queues, changed account copies and archive collisions fail closed", () => {
  const f = claimFixture(), ids = { attemptId: f.uuid(), commandId: f.uuid(), visitId: f.uuid(), writerId: f.uuid() };
  assert.throws(() => planVisualClaimInstall(f.journal, f.receipt, [f.guest], [newAttemptOutbox(f.account, ids)]), /PENDING_ACCOUNT_ATTEMPT/);
  assert.throws(() => planVisualClaimInstall(f.journal, f.receipt, [{ ...f.guest, generation: 1 }], [f.account]), /PENDING_WORK/);
  const collision = { ...f.account, key: `${f.accountKey}|${f.account.session.attemptId}`, generation: 99 };
  assert.throws(() => planVisualClaimInstall(f.journal, f.receipt, [f.guest], [f.pending, collision]), /LOCAL_CONFLICT/);
  const changed = { ...f.guest, key: f.accountKey, learner: f.receipt.learner, generation: 1, session: { ...f.guest.session, learner: f.receipt.learner, recordId: f.account.session.recordId } };
  assert.throws(() => planVisualClaimInstall(f.journal, f.receipt, [f.guest], [changed]), /LOCAL_CONFLICT/);
});
test("claim receipts cannot cross actor or foreground identity and reject duplicate or forged mappings", () => {
  const f = claimFixture();
  assert.throws(() => assertVisualClaimReceipt({ ...f.receipt, learner: "account:bob" }, f.journal), /INVALID_VISUAL_CLAIM_RECEIPT/);
  assert.throws(() => assertVisualClaimReceipt({ ...f.receipt, mappings: [...f.receipt.mappings, ...f.receipt.mappings] }, f.journal), /INVALID_VISUAL_CLAIM_RECEIPT/);
  assert.throws(() => assertVisualClaimReceipt({ ...f.receipt, mappings: [{ ...f.receipt.mappings[0], activeAttemptId: f.uuid() }] }, f.journal), /INVALID_VISUAL_CLAIM_RECEIPT/);
  assert.throws(() => assertVisualClaimReceipt({ ...f.receipt, token: "not allowed" }, f.journal), /INVALID_VISUAL_CLAIM_RECEIPT/);
});

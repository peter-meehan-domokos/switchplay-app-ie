import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { MongoClient } from "mongodb";
import { createVisualLearningRecordIndexes, VisualLearningRecordRepository } from "../src/lib/visualLearningRecords/repository";
import { createRootsHostedState, rootsSnapshot, reduceRootsHostedState } from "../src/app/step-visuals/activities/roots-factors/hostState";
import type { LearnerPrincipal, VisualBatch, VisualEventInput } from "../src/lib/visualLearningRecords/model";

let server: MongoMemoryReplSet, client: MongoClient;
before(async () => { server = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } }); client = await new MongoClient(server.getUri()).connect(); });
after(async () => { await client?.close(); await server?.stop(); });
const actor: LearnerPrincipal = { kind: "account", id: "learner-one" };
async function fixture(name: string, principal = actor) {
  const db = client.db(`visual_${name}`); await createVisualLearningRecordIndexes(db);
  const repo = new VisualLearningRecordRepository(db, client);
  const opened = await repo.open(principal, "roots-and-factors", randomUUID(), { kind: "direct" });
  const state = createRootsHostedState(opened.attempt.attemptId);
  const events: VisualEventInput[] = state.recorded.records.events.map(e => ({ eventId: randomUUID(), writerId: randomUUID(), clientSequence: e.sequence,
    clientOccurredAt: new Date().toISOString(), activityVersion: 1, eventSchema: 1, type: e.type, payload: e }));
  const batch: VisualBatch = { writeId: randomUUID(), expectedStateRevision: 0, visitId: opened.visit.visitId, activityVersion: 1, snapshotSchema: 1, events, snapshot: rootsSnapshot(state) };
  return { repo, opened, state, batch };
}
test("same learner and visual share one record across cards, retries and simultaneous first opens", async () => {
  const db = client.db("visual_open"); await createVisualLearningRecordIndexes(db);
  const repo = new VisualLearningRecordRepository(db, client);
  const [a, b] = await Promise.all([repo.open(actor, "roots-and-factors", randomUUID(), { kind: "card", cardId: "one", cardVersion: 1, stepId: "step", attachmentId: "visual" }),
    repo.open(actor, "roots-and-factors", randomUUID(), { kind: "card", cardId: "two", cardVersion: 2, stepId: "intro", attachmentId: "visual" })]);
  assert.equal(a.record.recordId, b.record.recordId); assert.equal(a.attempt.attemptId, b.attempt.attemptId);
  const retry = await repo.open(actor, "roots-and-factors", a.visit.visitId, a.visit.source);
  assert.equal(retry.visit.visitId, a.visit.visitId);
  assert.equal(await repo.records().countDocuments(), 1); assert.equal(await repo.attempts().countDocuments(), 1); assert.equal(await repo.visits().countDocuments(), 2);
  await assert.rejects(repo.open(actor, "roots-and-factors", a.visit.visitId, { kind: "direct" }), /VISUAL_VISIT_ID_CONFLICT/);
});
test("exact lost-response retries deduplicate events and snapshot-only writes", async () => {
  const { repo, opened, batch } = await fixture("retry");
  const one = await repo.append(actor, opened.attempt.attemptId, batch), two = await repo.append(actor, opened.attempt.attemptId, batch);
  assert.deepEqual(two, one); assert.equal(one.stateRevision, 1); assert.equal(await repo.events().countDocuments(), 1);
  const snapshotOnly = { ...batch, writeId: randomUUID(), expectedStateRevision: 1, events: [] };
  const first = await repo.append(actor, opened.attempt.attemptId, snapshotOnly), retry = await repo.append(actor, opened.attempt.attemptId, snapshotOnly);
  assert.deepEqual(first, retry); assert.equal(retry.stateRevision, 2);
  await assert.rejects(repo.append(actor, opened.attempt.attemptId, { ...snapshotOnly, expectedStateRevision: 2 }), /VISUAL_WRITE_ID_CONFLICT/);
});
test("stale snapshots cannot overwrite state but valid distinct events are retained", async () => {
  const { repo, opened, state, batch } = await fixture("conflict");
  await repo.append(actor, opened.attempt.attemptId, batch);
  const moved = reduceRootsHostedState(state, { type: "root", action: { type: "place", root: 4, revision: 0 } });
  const payload = moved.recorded.records.events.at(-1)!;
  const stale = { ...batch, writeId: randomUUID(), snapshot: rootsSnapshot(moved), events: [{ ...batch.events[0], eventId: randomUUID(), clientSequence: 2, type: payload.type, payload }] };
  const result = await repo.append(actor, opened.attempt.attemptId, stale);
  assert.equal(result.snapshotAccepted, false); assert.equal(result.conflict, true); assert.equal(result.acceptedEventIds.length, 1);
  const stored = await repo.current(actor, opened.record.recordId);
  assert.deepEqual(stored.attempt.snapshot, batch.snapshot); assert.equal(await repo.events().countDocuments(), 2);
  const retry = await repo.append(actor, opened.attempt.attemptId, stale);
  assert.equal(retry.snapshotAccepted, false); assert.equal(await repo.events().countDocuments(), 2);
});
test("changed event identity rolls the entire transaction back including preceding inserts", async () => {
  const { repo, opened, batch } = await fixture("atomic"); await repo.append(actor, opened.attempt.attemptId, batch);
  const wrong = { ...batch, writeId: randomUUID(), expectedStateRevision: 1, events: [
    { ...batch.events[0], eventId: randomUUID() }, { ...batch.events[0], clientOccurredAt: "2026-01-01T00:00:00.000Z" },
  ] };
  await assert.rejects(repo.append(actor, opened.attempt.attemptId, wrong), /VISUAL_EVENT_ID_CONFLICT/);
  assert.equal(await repo.events().countDocuments(), 1); assert.equal((await repo.current(actor, opened.record.recordId)).attempt.stateRevision, 1);
});
test("owner, visit, snapshot identity and disabled visual checks reject unauthorized writes", async () => {
  const { repo, opened, batch } = await fixture("ownership");
  const other: LearnerPrincipal = { kind: "account", id: "another-learner" };
  await assert.rejects(repo.current(other, opened.record.recordId), /FORBIDDEN/);
  await assert.rejects(repo.append(other, opened.attempt.attemptId, batch), /FORBIDDEN/);
  await assert.rejects(repo.open(other, "roots-and-factors", opened.visit.visitId, { kind: "direct" }), /FORBIDDEN/);
  await assert.rejects(repo.append(actor, opened.attempt.attemptId, { ...batch, visitId: randomUUID() }), /VISIT_FORBIDDEN/);
  await assert.rejects(repo.append(actor, opened.attempt.attemptId, { ...batch, snapshot: { ...batch.snapshot, attemptId: randomUUID() } }), /IDENTITY_MISMATCH/);
  const disabled = new VisualLearningRecordRepository(repo.db, client, ["roots-and-factors"]);
  await assert.rejects(disabled.append(actor, opened.attempt.attemptId, batch), /VISUAL_UNAVAILABLE/);
  assert.equal(await repo.events().countDocuments(), 0);
});
test("new attempts are idempotent, retain history and late batches or retries never reactivate old attempts", async () => {
  const { repo, opened, batch } = await fixture("attempts"); await repo.append(actor, opened.attempt.attemptId, batch);
  const command = { commandId: randomUUID(), attemptId: randomUUID(), expectedActiveAttemptId: opened.attempt.attemptId };
  const next = await repo.newAttempt(actor, opened.record.recordId, command);
  assert.equal(next.attemptNumber, 2);
  const later = await repo.newAttempt(actor, opened.record.recordId, { commandId: randomUUID(), attemptId: randomUUID(), expectedActiveAttemptId: next.attemptId });
  assert.equal((await repo.newAttempt(actor, opened.record.recordId, command)).attemptId, next.attemptId);
  await repo.append(actor, opened.attempt.attemptId, batch);
  assert.equal((await repo.current(actor, opened.record.recordId)).attempt.attemptId, later.attemptId);
  assert.equal(await repo.attempts().countDocuments(), 3); assert.equal(await repo.events().countDocuments(), 1);
  await assert.rejects(repo.newAttempt(actor, opened.record.recordId, { ...command, attemptId: randomUUID() }), /COMMAND_ID_CONFLICT/);
  await assert.rejects(repo.newAttempt(actor, opened.record.recordId, { ...command, commandId: randomUUID(), attemptId: randomUUID() }), /ACTIVE_ATTEMPT_CONFLICT/);
});
test("account and pseudonymous guest use the same architecture without cross-principal access", async () => {
  const guest: LearnerPrincipal = { kind: "guest", id: "learner-one" };
  const { repo, opened, batch } = await fixture("guest", guest);
  await repo.append(guest, opened.attempt.attemptId, batch);
  await assert.rejects(repo.current(actor, opened.record.recordId), /FORBIDDEN/);
  const account = await repo.open(actor, "roots-and-factors", randomUUID(), { kind: "direct" });
  assert.notEqual(account.record.recordId, opened.record.recordId); assert.equal(await repo.records().countDocuments(), 2);
});
test("writes refuse uninitialised indexes instead of weakening identity guarantees", async () => {
  const repo = new VisualLearningRecordRepository(client.db("visual_missing_indexes"), client);
  await assert.rejects(repo.open(actor, "roots-and-factors", randomUUID(), { kind: "direct" }), /VISUAL_INDEX_SETUP_REQUIRED/);
});

test("simultaneous revision writes accept one snapshot and preserve both distinct events", async () => {
  const { repo, opened, batch } = await fixture("simultaneous");
  const second = { ...batch, writeId: randomUUID(), events: [{ ...batch.events[0], eventId: randomUUID(), writerId: randomUUID() }] };
  const results = await Promise.all([repo.append(actor, opened.attempt.attemptId, batch), repo.append(actor, opened.attempt.attemptId, second)]);
  assert.equal(results.filter(r => r.snapshotAccepted).length, 1); assert.equal(results.filter(r => r.conflict).length, 1);
  assert.equal(await repo.events().countDocuments(), 2); assert.equal((await repo.current(actor, opened.record.recordId)).attempt.stateRevision, 1);
});

test("real completed activity records preserve first completion without replaying or touching card progress", async () => {
  const { repo, opened, batch, state } = await fixture("completion");
  let s = state;
  const place = (root: number) => { s = reduceRootsHostedState(s, { type: "root", action: { type: "place", root, revision: s.recorded.learning.manipulation.revision } }); };
  const act = (type: "ready" | "continue" | "check") => {
    s = reduceRootsHostedState(s, { type, revision: s.recorded.learning.manipulation.revision });
  };
  place(4); act("ready");
  s = reduceRootsHostedState(s, { type: "predict", choice: "plus", revision: s.recorded.learning.manipulation.revision });
  place(-3); act("continue"); place(-4); act("check");
  const events = s.recorded.records.events.map(e => ({ ...batch.events[0], eventId: randomUUID(), clientSequence: e.sequence, type: e.type, payload: e }));
  const completed = { ...batch, events, snapshot: rootsSnapshot(s) };
  await repo.append(actor, opened.attempt.attemptId, completed);
  const first = (await repo.current(actor, opened.record.recordId)).attempt;
  assert.ok(first.firstCompletedAt);
  await repo.append(actor, opened.attempt.attemptId, { ...completed, writeId: randomUUID(), expectedStateRevision: 1 });
  assert.deepEqual((await repo.current(actor, opened.record.recordId)).attempt.firstCompletedAt, first.firstCompletedAt);
  assert.equal(await repo.events().countDocuments(), events.length);
  assert.equal(await repo.db.collection("users").countDocuments(), 0);
  assert.equal(await repo.db.collection("cardTemplates").countDocuments(), 0);
});

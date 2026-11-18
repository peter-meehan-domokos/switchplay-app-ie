import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { MongoClient } from "mongodb";
import { createVisualLearningRecordIndexes, VisualLearningRecordRepository } from "../src/lib/visualLearningRecords/repository";
import { createRootsHostedState, rootsSnapshot, reduceRootsHostedState } from "../src/app/step-visuals/activities/roots-factors/hostState";
import type { LearnerPrincipal, VisualBatch, VisualEventInput } from "../src/lib/visualLearningRecords/model";
import { rootsMigration, testVersions } from "./helpers/visual-versions";
import { VISUAL_GUEST_COLLECTION, visualGuestExpiry } from "../src/lib/visualLearningRecords/guestCredentials";

let server: MongoMemoryReplSet, client: MongoClient;
before(async () => { server = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } }); client = await new MongoClient(server.getUri()).connect(); });
after(async () => { await client?.close(); await server?.stop(); });
const actor: LearnerPrincipal = { kind: "account", id: "learner-one" };
async function fixture(name: string, principal = actor) {
  const db = client.db(`visual_${name}`); await createVisualLearningRecordIndexes(db);
  const repo = new VisualLearningRecordRepository(db, client);
  if (principal.kind === "guest") await db.collection(VISUAL_GUEST_COLLECTION).insertOne({ guestId: principal.id, credentialHash: "repository-fixture-only", status: "active",
    createdAt: new Date(), lastActiveAt: new Date(), expiresAt: visualGuestExpiry(new Date()), useCount: 0 });
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
  await assert.rejects(repo.append(actor, opened.attempt.attemptId, { ...batch, snapshot: { ...rootsSnapshot(createRootsHostedState(opened.attempt.attemptId)), attemptId: randomUUID() } }), /IDENTITY_MISMATCH/);
  const disabled = new VisualLearningRecordRepository(repo.db, client, ["roots-and-factors"]);
  await assert.rejects(disabled.append(actor, opened.attempt.attemptId, batch), /VISUAL_UNAVAILABLE/);
  assert.equal(await repo.events().countDocuments(), 0);
});
test("new attempts are idempotent, retain history and late batches or retries never reactivate old attempts", async () => {
  const { repo, opened, batch } = await fixture("attempts"); await repo.append(actor, opened.attempt.attemptId, batch);
  const command = { commandId: randomUUID(), attemptId: randomUUID(), expectedActiveAttemptId: opened.attempt.attemptId };
  const next = await repo.newAttempt(actor, opened.record.recordId, command);
  assert.equal(next.attemptNumber, 2);
  assert.equal(next.command?.previousAttemptId, opened.attempt.attemptId);
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

async function legacyFixture(name: string) {
  const base = await fixture(name), id = base.opened.attempt.attemptId;
  await base.repo.attempts().updateOne({ attemptId: id }, { $set: { activityVersion: 0, startedRelease: 0 } });
  const batch: VisualBatch = { ...base.batch, activityVersion: 0, snapshot: { ...rootsSnapshot(base.state), activityVersion: 0 },
    events: base.batch.events.map(e => ({ ...e, activityVersion: 0, payload: { ...e.payload, activityVersion: 0 } })) };
  const old = new VisualLearningRecordRepository(base.repo.db, client, [], { codecs: testVersions.codecs, migrations: [] });
  await old.append(actor, id, batch);
  return { ...base, batch, repo: new VisualLearningRecordRepository(base.repo.db, client, [], testVersions) };
}
test("compatible publication checkpoints and converts once while exact old response retries stay idempotent", async () => {
  const { repo, opened, batch } = await legacyFixture("migration_open");
  const converted = await repo.open(actor, "roots-and-factors", randomUUID(), { kind: "direct" });
  assert.equal(converted.attempt.attemptId, opened.attempt.attemptId); assert.equal(converted.attempt.startedRelease, 0);
  assert.equal(converted.attempt.activityVersion, 1); assert.equal(converted.attempt.stateRevision, 2);
  assert.deepEqual(converted.attempt.snapshot, { ...batch.snapshot as object, activityVersion: 1 });
  await repo.open(actor, "roots-and-factors", converted.visit.visitId, { kind: "direct" });
  assert.equal(await repo.checkpoints().countDocuments(), 1); assert.equal(await repo.events().countDocuments(), 1);
  assert.deepEqual((await repo.checkpoints().findOne())!.snapshot, batch.snapshot);
  const retry = await repo.append(actor, opened.attempt.attemptId, batch);
  assert.equal(retry.snapshotAccepted, true); assert.equal(retry.stateRevision, 2);
  assert.equal((await repo.current(actor, opened.record.recordId)).attempt.stateRevision, 2);
});
test("format-only revision bridges retain pending old facts but never rebase a stale learner write", async () => {
  const { repo, opened, batch, state } = await legacyFixture("migration_bridge");
  await repo.open(actor, "roots-and-factors", randomUUID(), { kind: "direct" });
  const moved = reduceRootsHostedState(state, { type: "root", action: { type: "place", root: 4, revision: 0 } });
  const e = moved.recorded.records.events.at(-1)!;
  const pending = { ...batch, writeId: randomUUID(), expectedStateRevision: 1, snapshot: { ...rootsSnapshot(moved), activityVersion: 0 },
    events: [{ ...batch.events[0], eventId: randomUUID(), clientSequence: e.sequence, type: e.type, payload: { ...e, activityVersion: 0 } }] };
  const accepted = await repo.append(actor, opened.attempt.attemptId, pending);
  assert.equal(accepted.snapshotAccepted, true); assert.equal(accepted.stateRevision, 3);
  assert.equal((await repo.current(actor, opened.record.recordId)).attempt.activityVersion, 1);
  assert.equal(await repo.checkpoints().countDocuments(), 2); // source before Open + received old candidate
  assert.deepEqual(await repo.append(actor, opened.attempt.attemptId, pending), accepted);
  const stale = await repo.append(actor, opened.attempt.attemptId, { ...pending, writeId: randomUUID(), events: [{ ...pending.events[0], eventId: randomUUID() }] });
  assert.equal(stale.snapshotAccepted, false); assert.equal(stale.stateRevision, 3);
  assert.equal(await repo.events().countDocuments(), 3);
});
test("client migration checkpoints are owner-scoped and idempotent without installing raw snapshots", async () => {
  const { repo, opened, batch } = await legacyFixture("migration_client");
  const body = { checkpointId: randomUUID(), activityVersion: 0, snapshotSchema: 1, targetActivityVersion: 1, targetSnapshotSchema: 1,
    stateRevision: 1, visitId: opened.visit.visitId, snapshot: batch.snapshot };
  await repo.preserveMigration(actor, opened.attempt.attemptId, body); await repo.preserveMigration(actor, opened.attempt.attemptId, body);
  assert.equal(await repo.checkpoints().countDocuments(), 1);
  assert.equal((await repo.current(actor, opened.record.recordId)).attempt.stateRevision, 1);
  await assert.rejects(repo.preserveMigration({ kind: "account", id: "other" }, opened.attempt.attemptId, body), /FORBIDDEN/);
  await assert.rejects(repo.preserveMigration(actor, opened.attempt.attemptId, { ...body, stateRevision: 2 }), /CHECKPOINT_CONFLICT/);
  await assert.rejects(repo.preserveMigration(actor, opened.attempt.attemptId, { ...body, checkpointId: randomUUID(), visitId: randomUUID() }), /VISIT_FORBIDDEN/);
});
test("invalid activity conversions retain historical attempts for explicit recovery", async () => {
  const { repo, batch } = await legacyFixture("migration_bad");
  const broken = new VisualLearningRecordRepository(repo.db, client, [], { ...testVersions,
    migrations: [{ ...rootsMigration, convert: () => ({ ...batch.snapshot as object, activityVersion: 1, attemptNumber: 2 }) }] });
  const returned = await broken.open(actor, "roots-and-factors", randomUUID(), { kind: "direct" });
  assert.equal(returned.attempt.activityVersion, 0); assert.deepEqual(returned.attempt.snapshot, batch.snapshot);
  assert.equal(await repo.checkpoints().countDocuments(), 0); assert.equal(await repo.events().countDocuments(), 1);
});
test("recovery backs up pending facts and snapshots exactly once without overwriting unsafe state", async () => {
  const { repo, opened, batch, state } = await fixture("recovery_backup"); await repo.append(actor, opened.attempt.attemptId, batch);
  const moved = reduceRootsHostedState(state, { type: "root", action: { type: "place", root: 4, revision: 0 } }), e = moved.recorded.records.events.at(-1)!;
  const pending = { ...batch, writeId: randomUUID(), expectedStateRevision: 1, snapshot: rootsSnapshot(moved),
    events: [{ ...batch.events[0], eventId: randomUUID(), clientSequence: e.sequence, type: e.type, payload: e }] };
  await assert.rejects(repo.preserveRecovery(actor, opened.attempt.attemptId, pending), /RECOVERY_NOT_REQUIRED/);
  const unsafe = { cannotHydrate: true };
  await repo.attempts().updateOne({ attemptId: opened.attempt.attemptId }, { $set: { snapshot: unsafe } });
  await assert.rejects(repo.append(actor, opened.attempt.attemptId, pending), /RESTORATION_REQUIRED/);
  const ack = await repo.preserveRecovery(actor, opened.attempt.attemptId, pending);
  assert.equal(ack.validation, "known-codec"); assert.equal(ack.checkpointAccepted, true);
  assert.deepEqual(await repo.preserveRecovery(actor, opened.attempt.attemptId, pending), ack);
  assert.equal(await repo.events().countDocuments(), 2); assert.equal(await repo.checkpoints().countDocuments(), 1);
  assert.deepEqual((await repo.current(actor, opened.record.recordId)).attempt.snapshot, unsafe);
  assert.equal((await repo.current(actor, opened.record.recordId)).attempt.stateRevision, 1);
  await assert.rejects(repo.preserveRecovery(actor, opened.attempt.attemptId, { ...pending, expectedStateRevision: 2 }), /CHECKPOINT_CONFLICT/);
  await assert.rejects(repo.preserveRecovery({ kind: "account", id: "other" }, opened.attempt.attemptId, pending), /FORBIDDEN/);
  await assert.rejects(repo.preserveRecovery(actor, opened.attempt.attemptId, { ...pending, writeId: randomUUID(), visitId: randomUUID() }), /VISIT_FORBIDDEN/);
  const next = await repo.newAttempt(actor, opened.record.recordId, { commandId: randomUUID(), attemptId: randomUUID(), expectedActiveAttemptId: opened.attempt.attemptId });
  assert.equal(next.attemptNumber, 2); assert.equal(await repo.events().countDocuments(), 2);
  await repo.attempts().updateOne({ attemptId: opened.attempt.attemptId }, { $set: { snapshot: batch.snapshot } });
  assert.deepEqual(await repo.preserveRecovery(actor, opened.attempt.attemptId, pending), ack);
  assert.equal((await repo.current(actor, opened.record.recordId)).attempt.attemptId, next.attemptId);
});
test("unknown old formats are bounded opaque history and cannot fabricate a known completion summary", async () => {
  const { repo, opened, batch } = await fixture("recovery_opaque");
  await repo.attempts().updateOne({ attemptId: opened.attempt.attemptId }, { $set: { activityVersion: 99 } });
  const payload = { ...batch.events[0].payload, activityVersion: 99, type: "attempt-completed" };
  const raw = { ...batch, activityVersion: 99, snapshot: { olderFormat: "kept" },
    events: [{ ...batch.events[0], activityVersion: 99, type: payload.type, payload }] };
  const ack = await repo.preserveRecovery(actor, opened.attempt.attemptId, raw);
  assert.equal(ack.validation, "opaque-history"); assert.equal((await repo.events().findOne())!.validation, "opaque-history");
  assert.equal((await repo.current(actor, opened.record.recordId)).attempt.firstCompletedAt, undefined);
  await assert.rejects(repo.preserveRecovery(actor, opened.attempt.attemptId, { ...raw, writeId: randomUUID(), snapshot: { value: "x".repeat(4097) } }), /PAYLOAD_LIMIT/);
  await assert.rejects(repo.preserveRecovery(actor, opened.attempt.attemptId, { ...raw, writeId: randomUUID(), snapshot: { attemptId: randomUUID() } }), /IDENTITY_MISMATCH/);
  await assert.rejects(repo.preserveRecovery(actor, opened.attempt.attemptId, { ...raw, writeId: randomUUID(), events: [{ ...raw.events[0], clientSequence: 2 }] }), /INVALID_VISUAL_EVENT/);
});

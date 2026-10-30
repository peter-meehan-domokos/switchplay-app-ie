import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { before, after, test } from "node:test";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { MongoClient } from "mongodb";
import { createVisualLearningRecordIndexes, VisualLearningRecordRepository } from "../src/lib/visualLearningRecords/repository";
import { VisualGuestClaims } from "../src/lib/visualLearningRecords/guestClaims";
import { issueVisualGuest, authenticateVisualGuest, VISUAL_GUEST_CLAIMS_COLLECTION, VISUAL_GUEST_COLLECTION } from "../src/lib/visualLearningRecords/guestCredentials";
import { createVisualClaimApi } from "../src/lib/visualLearningRecords/claimApi";
import { visualSessionDto } from "../src/lib/visualLearningRecords/api";
import { initialVisualOutbox, newAttemptOutbox } from "../src/lib/visualLearningRecords/outbox";
import { createRootsHostedState, rootsSnapshot } from "../src/app/step-visuals/activities/roots-factors/hostState";
import type { LearnerPrincipal, VisualClaimRequest } from "../src/lib/visualLearningRecords/model";
import { assertVisualSnapshot } from "../src/lib/visualLearningRecords/contracts";

let server: MongoMemoryReplSet, client: MongoClient;
const account: LearnerPrincipal = { kind: "account", id: "account-one" };
before(async () => { server = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } }); client = await new MongoClient(server.getUri()).connect(); });
after(async () => { await client?.close(); await server?.stop(); });
async function fixture() {
  const db = client.db(`visual_claim_${randomUUID().replaceAll("-", "")}`); await createVisualLearningRecordIndexes(db);
  const repo = new VisualLearningRecordRepository(db, client), guest = await issueVisualGuest(db), claims = new VisualGuestClaims(repo);
  return { db, repo, guest, claims };
}
async function open(repo: VisualLearningRecordRepository, actor: LearnerPrincipal, id = "roots-and-factors") {
  return repo.open(actor, id, randomUUID(), { kind: "direct" });
}
async function save(repo: VisualLearningRecordRepository, actor: LearnerPrincipal, opened: Awaited<ReturnType<typeof open>>) {
  const state = createRootsHostedState(opened.attempt.attemptId, opened.attempt.attemptNumber), event = state.recorded.records.events[0];
  await repo.append(actor, opened.attempt.attemptId, { writeId: randomUUID(), expectedStateRevision: 0, visitId: opened.visit.visitId,
    activityVersion: 1, snapshotSchema: 1, snapshot: rootsSnapshot(state), events: [{ eventId: randomUUID(), writerId: randomUUID(), clientSequence: event.sequence,
      clientOccurredAt: new Date().toISOString(), activityVersion: 1, eventSchema: 1, type: event.type, payload: event }] });
}
const command = (previous: string, commandId = randomUUID()) => ({ commandId, attemptId: randomUUID(), expectedActiveAttemptId: previous });

test("claim retains account and guest attempts, snapshots, events and contexts while foreground guest wins exactly once", async () => {
  const { repo, guest, claims, db } = await fixture();
  const existing = await open(repo, account), anonymous = await open(repo, guest.principal);
  await save(repo, account, existing); await save(repo, guest.principal, anonymous);
  const accountNext = command(existing.attempt.attemptId), guestNext = command(anonymous.attempt.attemptId);
  await repo.newAttempt(account, existing.record.recordId, accountNext); await repo.newAttempt(guest.principal, anonymous.record.recordId, guestNext);
  const foreground = await open(repo, guest.principal); await save(repo, guest.principal, foreground);
  const attempts = await repo.attempts().find({}).sort({ attemptId: 1 }).toArray(), events = await repo.events().find({}).sort({ eventId: 1 }).toArray(), visits = await repo.visits().find({}).sort({ visitId: 1 }).toArray();
  const request = { claimId: randomUUID(), foregroundAttemptId: foreground.attempt.attemptId };
  const result = await claims.claim(account, guest.credential, request);
  assert.equal(result.mappings[0].recordId, existing.record.recordId); assert.equal(result.mappings[0].activeAttemptId, foreground.attempt.attemptId);
  const merged = await repo.current(account, existing.record.recordId); assert.equal(merged.record.attemptCount, 4); assert.equal(merged.attempt.attemptNumber, 2);
  assert.equal(await repo.attempts().countDocuments({ recordId: existing.record.recordId }), 4);
  assert.deepEqual((await repo.attempts().find({}).sort({ attemptId: 1 }).toArray()).map(attempt => ({ ...attempt, recordId: "ownership-only" })), attempts.map(attempt => ({ ...attempt, recordId: "ownership-only" })));
  assert.deepEqual(await repo.events().find({}).sort({ eventId: 1 }).toArray(), events); assert.deepEqual(await repo.visits().find({}).sort({ visitId: 1 }).toArray(), visits);
  assert.ok((await repo.records().findOne({ recordId: anonymous.record.recordId }))!.claimArchive);
  await assert.rejects(repo.current(account, anonymous.record.recordId), /FORBIDDEN/); // No redirect alias.
  assert.equal(await authenticateVisualGuest(db, guest.credential), null);
  const dto = visualSessionDto(account, merged.record, merged.attempt, foreground.visit.visitId);
  assert.equal(dto.nextAttemptNumber, 5);
  assertVisualSnapshot(dto.snapshot, "roots-and-factors", foreground.attempt.attemptId);
  const local = initialVisualOutbox({ ...dto, snapshot: dto.snapshot, visitId: foreground.visit.visitId }, randomUUID()), ids = { attemptId: randomUUID(), commandId: randomUUID(), writerId: randomUUID(), visitId: randomUUID() };
  const next = newAttemptOutbox(local, ids); assert.equal(next.session.attemptNumber, 5); assert.equal(next.session.nextAttemptNumber, 6);
  const registered = await repo.newAttempt(account, merged.record.recordId, next.command!.request); assert.equal(registered.attemptNumber, 5);
  // A lost claim response can be recovered by the bound account without the old
  // cookie; its immutable result never reactivates the previous guest attempt.
  assert.deepEqual(await claims.claim(account, undefined, request), result);
  assert.equal((await repo.current(account, merged.record.recordId)).attempt.attemptId, registered.attemptId);
});

test("nonforeground account progress stays active and a missing account record adopts the guest root directly", async () => {
  const { repo, guest, claims } = await fixture();
  const accountRoots = await open(repo, account), guestRoots = await open(repo, guest.principal), guestIntegration = await open(repo, guest.principal, "integration-area");
  const receipt = await claims.claim(account, guest.credential, { claimId: randomUUID(), foregroundAttemptId: guestIntegration.attempt.attemptId });
  assert.equal((await repo.current(account, accountRoots.record.recordId)).attempt.attemptId, accountRoots.attempt.attemptId);
  assert.equal((await repo.current(account, guestIntegration.record.recordId)).attempt.attemptId, guestIntegration.attempt.attemptId);
  assert.equal(receipt.mappings.find(m => m.guestRecordId === guestRoots.record.recordId)!.activeAttemptId, accountRoots.attempt.attemptId);
  assert.equal(await repo.attempts().countDocuments(), 3);
});

test("a barely-started foreground guest remains active over advanced account work, and incompatible history is never rewritten", async () => {
  const { repo, guest, claims } = await fixture(), existing = await open(repo, account), anonymous = await open(repo, guest.principal);
  await save(repo, account, existing);
  const receipt = await claims.claim(account, guest.credential, { claimId: randomUUID(), foregroundAttemptId: anonymous.attempt.attemptId });
  const current = await repo.current(account, receipt.mappings[0].recordId);
  assert.equal(current.attempt.attemptId, anonymous.attempt.attemptId); assert.equal(current.attempt.snapshot, null);
  assert.ok((await repo.attempts().findOne({ attemptId: existing.attempt.attemptId }))!.snapshot);
  const another = await fixture(), old = await open(another.repo, another.guest.principal);
  const historical = { activityVersion: 77, snapshotSchema: 9, snapshot: { oldAnswer: "retained only" } };
  await another.repo.attempts().updateOne({ attemptId: old.attempt.attemptId }, { $set: historical });
  await another.claims.claim(account, another.guest.credential, { claimId: randomUUID(), foregroundAttemptId: old.attempt.attemptId });
  const retained = await another.repo.current(account, old.record.recordId), dto = visualSessionDto(account, retained.record, retained.attempt, old.visit.visitId);
  assert.equal(dto.snapshot, null); assert.equal(dto.restoration.status, "new-attempt-required");
  assert.deepEqual(retained.attempt.snapshot, historical.snapshot); assert.equal(retained.attempt.activityVersion, 77);
});

test("historical command IDs scoped to different original records remain independently idempotent after claim", async () => {
  const { repo, guest, claims } = await fixture(), existing = await open(repo, account), anonymous = await open(repo, guest.principal);
  const sharedId = randomUUID(), accountCommand = command(existing.attempt.attemptId, sharedId), guestCommand = command(anonymous.attempt.attemptId, sharedId);
  await repo.newAttempt(account, existing.record.recordId, accountCommand); await repo.newAttempt(guest.principal, anonymous.record.recordId, guestCommand);
  await claims.claim(account, guest.credential, { claimId: randomUUID(), foregroundAttemptId: guestCommand.attemptId });
  assert.equal((await repo.newAttempt(account, existing.record.recordId, accountCommand)).attemptId, accountCommand.attemptId);
  assert.equal((await repo.newAttempt(account, existing.record.recordId, guestCommand)).attemptId, guestCommand.attemptId);
  await assert.rejects(repo.newAttempt(account, existing.record.recordId, command(guestCommand.attemptId, sharedId)), /COMMAND_ID_CONFLICT/);
  assert.equal((await repo.current(account, existing.record.recordId)).attempt.attemptId, guestCommand.attemptId);
});

test("simultaneous claim retries transfer once, and a racing guest write either commits before claim or is rejected intact", async () => {
  const { repo, guest, claims } = await fixture(), existing = await open(repo, account), anonymous = await open(repo, guest.principal);
  const request = { claimId: randomUUID(), foregroundAttemptId: anonymous.attempt.attemptId };
  const [first, second] = await Promise.all([claims.claim(account, guest.credential, request), claims.claim(account, guest.credential, request)]);
  assert.deepEqual(first, second); assert.equal((await repo.current(account, existing.record.recordId)).record.attemptCount, 2);
  const race = await fixture(), opened = await open(race.repo, race.guest.principal);
  const [write, claim] = await Promise.allSettled([save(race.repo, race.guest.principal, opened),
    race.claims.claim(account, race.guest.credential, { claimId: randomUUID(), foregroundAttemptId: opened.attempt.attemptId })]);
  assert.equal(claim.status, "fulfilled");
  const current = await race.repo.current(account, opened.record.recordId);
  if (write.status === "fulfilled") { assert.ok(current.attempt.snapshot); assert.equal(await race.repo.events().countDocuments(), 1); }
  else { assert.match(String(write.reason), /GUEST_FORBIDDEN/); assert.equal(current.attempt.snapshot, null); assert.equal(await race.repo.events().countDocuments(), 0); }
});

test("an interrupted multi-record claim retries its remaining transaction without repeating the completed foreground activation", async () => {
  const { repo, guest, db } = await fixture();
  await open(repo, account); const foreground = await open(repo, guest.principal);
  await open(repo, account, "integration-area"); await open(repo, guest.principal, "integration-area");
  let writes = 0, fail = true;
  class InterruptedRepository extends VisualLearningRecordRepository {
    override attempts() {
      const collection = super.attempts(), update = collection.updateMany.bind(collection);
      collection.updateMany = (async (...args: Parameters<typeof update>) => {
        if (++writes === 2 && fail) throw new Error("Injected second transfer failure");
        return update(...args);
      }) as typeof collection.updateMany;
      return collection;
    }
  }
  const claims = new VisualGuestClaims(new InterruptedRepository(db, client)), request = { claimId: randomUUID(), foregroundAttemptId: foreground.attempt.attemptId };
  await assert.rejects(claims.claim(account, guest.credential, request), /Injected/);
  const partial = (await db.collection(VISUAL_GUEST_CLAIMS_COLLECTION).findOne({ claimId: request.claimId }))!;
  assert.equal(partial.mappings.length, 1); assert.equal((await db.collection(VISUAL_GUEST_COLLECTION).findOne({ guestId: guest.principal.id }))!.status, "claiming");
  await assert.rejects(repo.open(guest.principal, "roots-and-factors", randomUUID(), { kind: "direct" }), /GUEST_FORBIDDEN/);
  const first = partial.mappings[0], chosen = command(first.activeAttemptId);
  await repo.newAttempt(account, first.recordId, chosen);
  fail = false; const complete = await claims.claim(account, undefined, request); assert.equal(complete.mappings.length, 2);
  assert.equal((await repo.current(account, first.recordId)).attempt.attemptId, chosen.attemptId);
  assert.equal(await repo.attempts().countDocuments(), 5);
});

test("claim API requires account identity and guest proof for a new claim, validates origin/body and denies cross-account receipt access", async () => {
  const { repo, guest, claims, db } = await fixture(), anonymous = await open(repo, guest.principal);
  const body: VisualClaimRequest = { claimId: randomUUID(), foregroundAttemptId: anonymous.attempt.attemptId };
  const request = (value: unknown = body, headers: Record<string, string> = {}) => new Request("https://app.example/api/visual-guests/claim", { method: "POST",
    headers: { Origin: "https://app.example", "Content-Type": "application/json", "X-Visual-Learner": "account:account-one", ...headers }, body: JSON.stringify(value) });
  let retired = false;
  const deps = { enabled: true, authenticateAccount: async () => account, readCredential: async () => guest.credential, claims: async () => claims, retireCredential: async () => { retired = true; } };
  assert.equal((await createVisualClaimApi({ ...deps, authenticateAccount: async () => null })(request())).status, 401);
  assert.equal((await createVisualClaimApi(deps)(request(body, { Origin: "https://attacker.example" }))).status, 403);
  assert.equal((await createVisualClaimApi({ ...deps, readCredential: async () => undefined })(request())).status, 403);
  assert.equal((await createVisualClaimApi(deps)(request({ ...body, guestId: guest.principal.id }))).status, 400);
  assert.equal((await createVisualClaimApi(deps)(request(body, { "X-Visual-Learner": "account:someone-else" }))).status, 409);
  const success = await createVisualClaimApi(deps)(request()); assert.equal(success.status, 200); assert.equal(success.headers.get("Cache-Control"), "private, no-store");
  const receipt = await success.json(); assert.equal(receipt.learner, "account:account-one"); assert.ok(!JSON.stringify(receipt).includes(guest.credential));
  assert.equal(retired, true); retired = false;
  const unrelated = await issueVisualGuest(db);
  assert.equal((await createVisualClaimApi({ ...deps, readCredential: async () => unrelated.credential })(request())).status, 200);
  assert.equal(retired, false); assert.ok(await authenticateVisualGuest(db, unrelated.credential));
  await assert.rejects(claims.claim({ kind: "account", id: "other" }, guest.credential, body), /CLAIM_FORBIDDEN/);
  await assert.rejects(claims.claim(account, guest.credential, { ...body, foregroundAttemptId: randomUUID() }), /CLAIM_ID_CONFLICT/);
  assert.equal(await db.collection("users").countDocuments(), 0); // Repository caller supplies authenticated account; no user mutation.
  assert.equal(await repo.events().countDocuments(), 0);
});

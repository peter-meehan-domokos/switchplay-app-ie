import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { before, after, test } from "node:test";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { MongoClient } from "mongodb";
import { createVisualLearningRecordIndexes, VisualLearningRecordRepository } from "../src/lib/visualLearningRecords/repository";
import { authenticateVisualGuest, issueVisualGuest, parseVisualGuestCredential, touchVisualGuest, VISUAL_GUEST_COLLECTION } from "../src/lib/visualLearningRecords/guestCredentials";
import { createVisualGuestApi } from "../src/lib/visualLearningRecords/guestApi";
import { createVisualApi } from "../src/lib/visualLearningRecords/api";
import { createRootsHostedState, rootsSnapshot } from "../src/app/step-visuals/activities/roots-factors/hostState";

let server: MongoMemoryReplSet, client: MongoClient;
before(async () => { server = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } }); client = await new MongoClient(server.getUri()).connect(); });
after(async () => { await client?.close(); await server?.stop(); });
function request(body: unknown = { activityId: "roots-and-factors" }, headers: Record<string, string> = {}) {
  return new Request("https://app.example/api/visual-guests/session", { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://app.example", ...headers }, body: JSON.stringify(body) });
}
async function fixture() {
  const db = client.db(`switchplay_visual_guest_${randomUUID().replaceAll("-", "")}`); await createVisualLearningRecordIndexes(db);
  return { db, repo: new VisualLearningRecordRepository(db, client) };
}
test("guest bootstrap returns a stable public handle and secure hash-backed return identity without a users entry", async () => {
  const { db } = await fixture(); let cookie: string | undefined;
  const api = createVisualGuestApi({ database: async () => db, readCredential: async () => cookie,
    writeCredential: async (value, age) => { cookie = value; assert.ok(age > 0); }, consumeIssuanceBudget: () => true });
  const first = await api(request()); assert.equal(first.status, 200); assert.equal(first.headers.get("Cache-Control"), "private, no-store");
  const dto = await first.json(), original = cookie!; assert.match(dto.learner, /^guest:/);
  assert.deepEqual(Object.keys(dto), ["learner"]); assert.ok(!JSON.stringify(dto).includes(original));
  const stored = (await db.collection(VISUAL_GUEST_COLLECTION).findOne({}))!;
  assert.equal(stored.credentialHash, parseVisualGuestCredential(original)!.credentialHash); assert.ok(!JSON.stringify(stored).includes(original.split(".")[1]));
  assert.deepEqual(await (await api(request())).json(), dto); assert.equal(cookie, original);
  assert.equal(await db.collection(VISUAL_GUEST_COLLECTION).countDocuments(), 1); assert.equal(await db.collection("users").countDocuments(), 0);
  assert.equal(await db.collection("visualRecords").countDocuments(), 0); // Bootstrap is not an activity attempt.
  assert.equal(await authenticateVisualGuest(db, `${stored.guestId}.${"b".repeat(43)}`), null);
  assert.equal(await authenticateVisualGuest(db, stored.guestId), null);
});
test("bootstrap validates origin, body, availability and issuance budget before allocating a credential", async () => {
  const { db } = await fixture(); let reads = 0;
  const deps = { database: async () => { reads++; return db; }, readCredential: async () => undefined, writeCredential: async () => {}, consumeIssuanceBudget: () => false };
  assert.equal((await createVisualGuestApi(deps)(request(undefined, { Origin: "https://attacker.example" }))).status, 403);
  assert.equal((await createVisualGuestApi(deps)(request({ activityId: "missing" }))).status, 404);
  assert.equal((await createVisualGuestApi(deps)(request({ activityId: "roots-and-factors", token: "forged" }))).status, 400);
  assert.equal((await createVisualGuestApi(deps)(request())).status, 429); assert.equal(reads, 0);
  assert.equal((await createVisualGuestApi({ ...deps, consumeIssuanceBudget: () => true, consumeRequestBudget: () => false })(request())).status, 429);
  assert.equal(reads, 0);
});
test("expiry is sliding but expired, lost and disabled credentials cannot recover records by a guessed handle", async () => {
  const { db, repo } = await fixture(), old = new Date(Date.now() - 45 * 86400000), guest = await issueVisualGuest(db, old);
  const originalExpiry = guest.expiresAt;
  await touchVisualGuest(db, guest.principal); const touched = (await db.collection(VISUAL_GUEST_COLLECTION).findOne({ guestId: guest.principal.id }))!;
  assert.ok(touched.expiresAt > originalExpiry);
  const opened = await repo.open(guest.principal, "roots-and-factors", randomUUID(), { kind: "direct" });
  await db.collection(VISUAL_GUEST_COLLECTION).updateOne({ guestId: guest.principal.id }, { $set: { expiresAt: new Date(0) } });
  assert.equal(await authenticateVisualGuest(db, guest.credential), null);
  await assert.rejects(repo.current(guest.principal, opened.record.recordId), /VISUAL_GUEST_FORBIDDEN/);
  let cleared = false;
  const response = await createVisualGuestApi({ database: async () => db, readCredential: async () => guest.credential,
    writeCredential: async (value, age) => { cleared = value === "" && age === 0; }, consumeIssuanceBudget: () => true })(request());
  assert.equal(response.status, 401); assert.equal(cleared, true); assert.equal(await repo.attempts().countDocuments(), 1);
  const replacement = await issueVisualGuest(db); await assert.rejects(repo.current(replacement.principal, opened.record.recordId), /VISUAL_RECORD_FORBIDDEN/);
});
test("guest meaningful events use the common repository and a revoked authenticated guest fails the transaction recheck", async () => {
  const { db, repo } = await fixture(), guest = await issueVisualGuest(db);
  const opened = await repo.open(guest.principal, "roots-and-factors", randomUUID(), { kind: "direct" });
  const state = createRootsHostedState(opened.attempt.attemptId), event = state.recorded.records.events[0];
  const batch = { writeId: randomUUID(), expectedStateRevision: 0, visitId: opened.visit.visitId, activityVersion: 1, snapshotSchema: 1,
    snapshot: rootsSnapshot(state), events: [{ eventId: randomUUID(), writerId: randomUUID(), clientSequence: event.sequence, clientOccurredAt: new Date().toISOString(), activityVersion: 1, eventSchema: 1, type: event.type, payload: event }] };
  const first = await repo.append(guest.principal, opened.attempt.attemptId, batch); assert.equal(first.snapshotAccepted, true);
  assert.deepEqual(await repo.append(guest.principal, opened.attempt.attemptId, batch), first); assert.equal(await repo.events().countDocuments(), 1);
  const api = createVisualApi({ authenticate: async () => {
    const authenticated = await authenticateVisualGuest(db, guest.credential);
    await db.collection(VISUAL_GUEST_COLLECTION).updateOne({ guestId: guest.principal.id }, { $set: { status: "claimed" } });
    return authenticated;
  }, repository: async () => repo, authorizeSource: async (_actor, _id, source) => source });
  const response = await api.batch(request({ ...batch, writeId: randomUUID(), expectedStateRevision: 1 }, { "X-Visual-Learner": `guest:${guest.principal.id}` }), opened.attempt.attemptId);
  assert.equal(response.status, 403); assert.equal((await response.json()).code, "VISUAL_GUEST_FORBIDDEN");
  assert.equal((await repo.attempts().findOne({ attemptId: opened.attempt.attemptId }))!.stateRevision, 1);
  assert.equal(await repo.events().countDocuments(), 1);
  await assert.rejects(repo.open(guest.principal, "integration-area", randomUUID(), { kind: "direct" }), /VISUAL_GUEST_FORBIDDEN/);
});

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { before, after, test } from "node:test";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { MongoClient } from "mongodb";
import { CardRepository, createFoundationIndexes } from "../src/lib/cards/repository";
import { createDefaultCardContent, createDefaultDeckContent } from "../src/lib/cards/creatorDefaults";
import { withStepMedia } from "../src/lib/stepMedia";
import { createVisualApi } from "../src/lib/visualLearningRecords/api";
import { createVisualLearningRecordIndexes, VisualLearningRecordRepository } from "../src/lib/visualLearningRecords/repository";
import { authorizeVisualSource } from "../src/lib/visualLearningRecords/sourceAccess";
import { createRootsHostedState, rootsSnapshot } from "../src/app/step-visuals/activities/roots-factors/hostState";
import type { LearnerPrincipal, VisualSource } from "../src/lib/visualLearningRecords/model";
import { VisualRecordError } from "../src/lib/visualLearningRecords/contracts";

let server: MongoMemoryReplSet, client: MongoClient, cards: CardRepository, records: VisualLearningRecordRepository;
const actor: LearnerPrincipal = { kind: "account", id: "learner" };
before(async () => {
  server = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } }); client = await new MongoClient(server.getUri()).connect();
  const db = client.db("switchplay_test_visual_api"); await createFoundationIndexes(db); await createVisualLearningRecordIndexes(db);
  cards = new CardRepository(db, client, "1"); records = new VisualLearningRecordRepository(db, client);
  await cards.users().insertMany(["learner", "owner", "other"].map(_id => ({ _id, cardsData: [], decksData: [] })));
  for (const [id, visibility] of [["public-card", "public"], ["private-card", "private"]] as const) {
    const content = createDefaultCardContent([`${id}-1`, `${id}-2`, `${id}-3`]); content.intro.title = "Activity practice";
    content.intro = withStepMedia(content.intro, [{ id: "visual", label: "Explore", kind: "activity", activityId: "roots-and-factors" }]);
    await cards.createCardDraft("owner", content, visibility, id); await cards.publishCard("owner", id, 0);
  }
});
after(async () => { await client?.close(); await server?.stop(); });
function api(principal: LearnerPrincipal | null = actor, enabled = true) {
  return createVisualApi({ enabled, authenticate: async () => principal, repository: async () => records,
    authorizeSource: (actor, activityId, source) => authorizeVisualSource(cards, actor, activityId, source) });
}
function request(body?: unknown, headers: Record<string, string> = {}) {
  return new Request("https://app.example/api/visual-sessions/open", { method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", Origin: "https://app.example", "X-Visual-Learner": "account:learner", ...headers },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
}
const openBody = (source: VisualSource = { kind: "direct" }) => ({ activityId: "roots-and-factors", visitId: randomUUID(), source });
test("missing visual indexes fail closed and authoritative setup restores lookup and opening", async () => {
  const db = client.db("switchplay_test_visual_index_setup"), repo = new VisualLearningRecordRepository(db, client);
  const endpoint = createVisualApi({ enabled: true, authenticate: async () => actor, repository: async () => repo,
    authorizeSource: async (_actor, _activityId, source) => source });
  const existing = () => endpoint.existing(new Request("https://app.example/api/visual-sessions/existing?activityId=integration-area", { headers: { "X-Visual-Learner": "account:learner" } }));
  const missing = await existing(); assert.equal(missing.status, 503); assert.equal((await missing.json()).code, "VISUAL_INDEX_SETUP_REQUIRED");
  await createVisualLearningRecordIndexes(db); await repo.assertIndexesReady();
  const fresh = await existing(); assert.equal(fresh.status, 200); assert.deepEqual(await fresh.json(), { hasAttempt: false });
  const opened = await endpoint.open(request({ ...openBody(), activityId: "integration-area" })); assert.equal(opened.status, 200);
  assert.deepEqual(await (await existing()).json(), { hasAttempt: true });
  const switched = await endpoint.existing(new Request("https://app.example/api/visual-sessions/existing?activityId=integration-area", { headers: { "X-Visual-Learner": "account:other" } }));
  assert.equal(switched.status, 409);
});
test("preview existence is owner-scoped and read-only, including completed attempts", async () => {
  const principal = { kind: "account", id: "preview-owner" } as const;
  const check = (actor = principal, query = "activityId=roots-and-factors") => api(actor).existing(new Request(`https://app.example/api/visual-sessions/existing?${query}`, { headers: { "X-Visual-Learner": `account:${actor.id}` } }));
  const counts = async () => Promise.all([records.records().countDocuments(), records.attempts().countDocuments(), records.visits().countDocuments(), records.events().countDocuments()]);
  const before = await counts(); assert.deepEqual(await (await check()).json(), { hasAttempt: false }); assert.deepEqual(await counts(), before);
  const opened = await records.open(principal, "roots-and-factors", randomUUID(), { kind: "direct" });
  await records.attempts().updateOne({ attemptId: opened.attempt.attemptId }, { $set: { firstCompletedAt: new Date() } });
  const afterOpen = await counts(), record = await records.records().findOne({ recordId: opened.record.recordId });
  const response = await check(); assert.equal(response.headers.get("Cache-Control"), "private, no-store"); assert.deepEqual(await response.json(), { hasAttempt: true });
  assert.deepEqual(await counts(), afterOpen); assert.deepEqual(await records.records().findOne({ recordId: opened.record.recordId }), record);
  const other = { kind: "account", id: "preview-other" } as const;
  assert.deepEqual(await (await api(other).existing(new Request("https://app.example/api/visual-sessions/existing?activityId=roots-and-factors", { headers: { "X-Visual-Learner": "account:preview-other" } }))).json(), { hasAttempt: false });
  assert.equal((await check(principal, "activityId=roots-and-factors&learner=preview-owner")).status, 400);
  assert.equal((await check(principal, "activityId=roots-and-factors&activityId=integration-area")).status, 400);
});
test("accepted Open replay retains owned visit provenance after source removal without authorizing new visits", async () => {
  let available = true, checks = 0;
  const owner: LearnerPrincipal = { kind: "account", id: "replay-owner" };
  const endpoint = (actor = owner) => createVisualApi({ enabled: true, authenticate: async () => actor, repository: async () => records,
    authorizeSource: async (_actor, _activityId, source) => { checks++; if (!available) throw new VisualRecordError("VISUAL_SOURCE_FORBIDDEN");
      return source.kind === "card" ? { ...source, deckVersion: 1 } : source; } });
  const send = (body: unknown, actor = owner) => request(body, { "X-Visual-Learner": `${actor.kind}:${actor.id}` });
  for (const source of [{ kind: "card", mode: "working", cardId: "retired-card", cardVersion: 1, deckId: "adopted-deck", stepId: "intro", attachmentId: "visual" },
    { kind: "framework", frameworkId: "prior-framework", frameworkItemId: "prior-item" }] as VisualSource[]) {
    available = true;
    const body = openBody(source), initial = await (await endpoint().open(send(body))).json();
    assert.ok(initial.attemptId); available = false; const previousChecks = checks;
    const replay = await endpoint().open(send(body)); assert.equal(replay.status, 200);
    const restored = await replay.json(); assert.equal(restored.attemptId, initial.attemptId); assert.equal(restored.visitId, initial.visitId);
    assert.equal(checks, previousChecks); assert.equal(restored.source, undefined); assert.equal(restored.content, undefined);
    assert.equal((await endpoint().open(send({ ...body, visitId: randomUUID() }))).status, 403);
    const other = { kind: "account", id: "not-owner" } as const;
    assert.equal((await endpoint(other).open(send(body, other))).status, 403);
    assert.equal((await endpoint().open(send({ ...body, source: { ...source, ...(source.kind === "card" ? { deckVersion: 2 } : { frameworkItemId: "changed" }) } }))).status, 409);
    const visit = (await records.visits().findOne({ visitId: initial.visitId }))!;
    assert.deepEqual(visit.source, source.kind === "card" ? { ...source, deckVersion: 1 } : source);
  }
});
test("authentication, actor binding, same-origin, feature gate and body limits fail closed", async () => {
  assert.equal((await api(null).open(request(openBody()))).status, 401);
  assert.equal((await api(actor, false).open(request(openBody()))).status, 404);
  assert.equal((await api().open(request(openBody(), { Origin: "https://elsewhere.example" }))).status, 403);
  assert.equal((await api().open(request(openBody(), { "X-Visual-Learner": "account:other" }))).status, 409);
  assert.equal((await api().open(request({ ...openBody(), padding: "x".repeat(9000) }))).status, 413);
  assert.equal((await api().open(request(openBody(), { "Content-Type": "text/plain" }))).status, 400);
  const invalid = new Request("https://app.example/api/visual-sessions/open", { method: "POST", headers: { Origin: "https://app.example", "X-Visual-Learner": "account:learner", "Content-Type": "application/json" }, body: "{" });
  assert.equal((await api().open(invalid)).status, 400);
});
test("real API responses persist state, acknowledge exact retries and expose only private DTO fields", async () => {
  const openedResponse = await api().open(request(openBody())); assert.equal(openedResponse.status, 200);
  assert.equal(openedResponse.headers.get("Cache-Control"), "private, no-store");
  const opened = await openedResponse.json(); assert.equal(opened.learner, "account:learner"); assert.equal(opened._id, undefined); assert.equal(opened.principalKey, undefined);
  const state = createRootsHostedState(opened.attemptId), event = state.recorded.records.events[0];
  const batch = { writeId: randomUUID(), expectedStateRevision: 0, visitId: opened.visitId, activityVersion: 1, snapshotSchema: 1, snapshot: rootsSnapshot(state),
    events: [{ eventId: randomUUID(), writerId: randomUUID(), clientSequence: 1, clientOccurredAt: new Date().toISOString(), activityVersion: 1, eventSchema: 1, type: event.type, payload: event }] };
  const saved = await api().batch(request(batch), opened.attemptId); assert.equal(saved.status, 200);
  const ack = await saved.json(); assert.equal(ack.snapshotAccepted, true);
  assert.deepEqual(await (await api().batch(request(batch), opened.attemptId)).json(), ack);
  const current = await api().current(request(), opened.recordId); assert.equal(current.status, 200);
  assert.deepEqual((await current.json()).snapshot, batch.snapshot);
  const denied = await api({ kind: "account", id: "other" }).current(request(undefined, { "X-Visual-Learner": "account:other" }), opened.recordId);
  assert.equal(denied.status, 403); assert.equal(denied.headers.get("Cache-Control"), "private, no-store");
});
test("card context verifies exact immutable version, destination, attachment and visual", async () => {
  const source: VisualSource = { kind: "card", mode: "canonical", cardId: "public-card", cardVersion: 1, stepId: "intro", attachmentId: "visual" };
  assert.equal((await api().open(request(openBody(source)))).status, 200);
  for (const changed of [ { ...source, cardId: "private-card" }, { ...source, stepId: "public-card-1" }, { ...source, attachmentId: "missing" },
    { ...source, cardVersion: 3 }, { ...source, deckId: "unverified-deck" }, { ...source, mode: "working" as const } ]) {
    const response = await api().open(request(openBody(changed))); assert.notEqual(response.status, 200);
  }
  const body = { ...openBody(source), activityId: "integration-area" };
  assert.equal((await api().open(request(body))).status, 403);
  assert.equal((await api().open(request(openBody({ kind: "direct", journeyId: "unverified-demo" })))).status, 403);
});
test("framework references are independently verified without building Progress interfaces", async () => {
  const source: VisualSource = { kind: "framework", frameworkId: "leaving-cert-hl", frameworkItemId: "factor-theorem" };
  assert.equal((await api().open(request(openBody(source)))).status, 200);
  assert.equal((await api().open(request(openBody({ ...source, frameworkItemId: "integration" })))).status, 403);
});

test("working deck context derives the adopted version and rejects cross-deck or private-era access", async () => {
  const deck = await cards.createDeckDraft("owner", { ...createDefaultDeckContent([]), title: "Visual practice", cards: [{ cardTemplateId: "public-card" }] }, "public");
  await cards.publishDeck("owner", deck.deckTemplateId, 0);
  await cards.ensureDeckData("learner", deck.deckTemplateId, 1); await cards.ensureCardData("learner", "public-card", 1);
  const source: VisualSource = { kind: "card", mode: "working", cardId: "public-card", cardVersion: 1, stepId: "intro", attachmentId: "visual", deckId: deck.deckTemplateId };
  const opened = await api().open(request(openBody(source))); assert.equal(opened.status, 200);
  const data = await opened.json(); const visit = await records.visits().findOne({ visitId: data.visitId });
  assert.equal(visit?.source.deckVersion, 1);
  assert.notEqual((await api().open(request(openBody({ ...source, deckVersion: 2 })))).status, 200);
  const unrelated = await cards.createDeckDraft("owner", { ...createDefaultDeckContent([]), title: "Unrelated" }, "public");
  await cards.publishDeck("owner", unrelated.deckTemplateId, 0);
  assert.equal((await api().open(request(openBody({ ...source, mode: "canonical", deckId: unrelated.deckTemplateId, deckVersion: 1 })))).status, 403);
  // A public root does not retroactively authorize its private immutable version.
  await cards.cards().updateOne({ cardTemplateId: "private-card" }, { $set: { visibility: "public" } });
  assert.equal((await api().open(request(openBody({ ...source, mode: "canonical", cardId: "private-card", deckId: undefined })))).status, 403);
});

test("unsafe saved state is withheld from execution and preserved through explicit recovery", async () => {
  const record = (await records.records().findOne({ principalKey: "account:learner", activityId: "roots-and-factors" }))!;
  const attempt = (await records.attempts().findOne({ attemptId: record.activeAttemptId }))!;
  const damaged = { cannotHydrate: true };
  await records.db.collection("visualAttempts").updateOne({ attemptId: attempt.attemptId }, { $set: { snapshot: damaged } });
  const opened = await api().open(request(openBody())); assert.equal(opened.status, 200);
  const dto = await opened.json(); assert.equal(dto.restoration.status, "new-attempt-required"); assert.equal(dto.snapshot, null);
  const historyBefore = await records.events().countDocuments({ attemptId: attempt.attemptId });
  const command = { commandId: randomUUID(), attemptId: randomUUID(), expectedActiveAttemptId: attempt.attemptId };
  const fresh = await api().newAttempt(request(command), record.recordId); assert.equal(fresh.status, 200);
  const result = await fresh.json(); assert.equal(result.restoration.status, "ready"); assert.equal(result.attemptNumber, attempt.attemptNumber + 1);
  assert.deepEqual((await records.db.collection("visualAttempts").findOne({ attemptId: attempt.attemptId }))!.snapshot, damaged);
  assert.equal(await records.events().countDocuments({ attemptId: attempt.attemptId }), historyBefore);
});

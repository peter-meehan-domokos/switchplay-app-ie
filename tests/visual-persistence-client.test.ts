import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createAccountVisualPersistence } from "../src/lib/visualLearningRecords/client";
import type { VisualOutboxStore } from "../src/lib/visualLearningRecords/browserStore";
import type { VisualOutbox, VisualSession } from "../src/lib/visualLearningRecords/outbox";
import { createRootsHostedState, reduceRootsHostedState, rootsSnapshot } from "../src/app/step-visuals/activities/roots-factors/hostState";

function memoryStore() {
  const rows = new Map<string, VisualOutbox>(), opens = new Map(); let fail = false;
  const store: VisualOutboxStore = {
    async transition(key, attemptId, create) {
      if (fail) throw new Error("Storage quota");
      const previous = rows.get(key); if (!previous || previous.session.attemptId !== attemptId) throw new Error("VISUAL_ACTIVE_ATTEMPT_CONFLICT");
      const next = create(structuredClone(previous)); rows.set(next.command!.predecessorKey, { ...structuredClone(previous), key: next.command!.predecessorKey }); rows.set(key, structuredClone(next)); return structuredClone(next);
    },
    async list(learner) { return structuredClone([...rows.values()].filter(row => row.learner === learner)); },
    async read(key) { return structuredClone(rows.get(key)); },
    async update(key, change) { if (fail) throw new Error("Storage quota"); const next = change(structuredClone(rows.get(key))); rows.set(key, structuredClone(next)); return structuredClone(next); },
    async opening(key, next) { if (next === null) opens.delete(key); else if (next) opens.set(key, structuredClone(next)); return structuredClone(opens.get(key)); },
  };
  return { store, rows, quota: (value: boolean) => { fail = value; } };
}
function transport() {
  const attemptId = randomUUID();
  let session: VisualSession = { learner: "account:one", recordId: randomUUID(), activityId: "roots-and-factors", activeAttemptId: attemptId,
    attemptId, attemptNumber: 1, stateRevision: 0, activityVersion: 1, snapshotSchema: 1, snapshot: null, visitId: randomUUID() };
  const receipts = new Map<string, VisualSession>();
  const bodies: string[] = [], commands: string[] = []; let delayed: (() => void) | undefined, delay = false, lose = false, loseCommand = false, offline = false;
  const fetcher: typeof fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(new Headers(init?.headers).get("X-Visual-Learner"), "account:one");
    const json = (body: unknown) => Response.json(body, { headers: { "X-Visual-Learner": "account:one" } });
    if (offline) throw new TypeError("Offline");
    if (String(_input).endsWith("/open")) return json({ ...session, visitId: body.visitId });
    if (String(_input).endsWith("/attempts")) {
      commands.push(String(init?.body));
      const previous = receipts.get(body.commandId);
      if (previous) return json({ ...previous, activeAttemptId: session.activeAttemptId });
      assert.equal(body.expectedActiveAttemptId, session.attemptId);
      session = { ...session, attemptId: body.attemptId, activeAttemptId: body.attemptId, attemptNumber: session.attemptNumber + 1, stateRevision: 0, snapshot: null };
      receipts.set(body.commandId, session);
      if (loseCommand) { loseCommand = false; throw new TypeError("Command response lost"); }
      return json(session);
    }
    bodies.push(String(init?.body));
    const ack = { writeId: body.writeId, acceptedEventIds: body.events.map((e: { eventId: string }) => e.eventId), snapshotAccepted: true, conflict: false, stateRevision: body.expectedStateRevision + 1 };
    if (delay) { delay = false; await new Promise<void>(resolve => { delayed = resolve; }); }
    session = { ...session, snapshot: body.snapshot, stateRevision: ack.stateRevision };
    if (lose) { lose = false; throw new TypeError("Response lost after server commit"); }
    return json(ack);
  };
  return { fetcher, bodies, commands, hold: () => { delay = true; }, drop: () => { lose = true; }, dropCommand: () => { loseCommand = true; },
    offline: (value: boolean) => { offline = value; }, release: () => delayed?.() };
}
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
test("a fresh empty attempt is pending until its initial snapshot is actually acknowledged", async t => {
  const memory = memoryStore(), wire = transport();
  const service = createAccountVisualPersistence({ learner: "account:one", store: memory.store, fetch: wire.fetcher }); t.after(service.dispose);
  const opened = await service.open("roots-and-factors", { kind: "direct" });
  let status = ""; service.subscribe!(opened.attemptId, next => { status = next; }); await tick();
  assert.equal(status, "Changes pending");
  const state = createRootsHostedState(opened.attemptId);
  await service.save(opened, rootsSnapshot(state), state.recorded.records.events); await service.flush!(opened.attemptId);
  assert.equal(status, "Saved");
});
test("client serializes sends and an older response cannot falsely mark newer state saved", async t => {
  const memory = memoryStore(), wire = transport();
  const service = createAccountVisualPersistence({ learner: "account:one", store: memory.store, fetch: wire.fetcher }); t.after(service.dispose);
  const opened = await service.open("roots-and-factors", { kind: "direct" }), state = createRootsHostedState(opened.attemptId);
  const statuses: string[] = []; service.subscribe!(opened.attemptId, status => statuses.push(status));
  await service.save(opened, rootsSnapshot(state), state.recorded.records.events);
  wire.hold(); const flushing = service.flush!(opened.attemptId); await tick();
  const moved = reduceRootsHostedState(state, { type: "root", action: { type: "place", root: 4, revision: 0 } });
  await service.save(opened, rootsSnapshot(moved), moved.recorded.records.events);
  assert.equal(statuses.at(-1), "Changes pending"); wire.release(); await flushing;
  assert.equal(wire.bodies.length, 2); assert.equal(statuses.at(-1), "Saved");
  assert.equal(JSON.parse(wire.bodies[1]).expectedStateRevision, 1);
});
test("a lost response retries the identical persisted body after a new client instance opens", async t => {
  const memory = memoryStore(), wire = transport();
  const first = createAccountVisualPersistence({ learner: "account:one", store: memory.store, fetch: wire.fetcher });
  const opened = await first.open("roots-and-factors", { kind: "direct" }), state = createRootsHostedState(opened.attemptId);
  await first.save(opened, rootsSnapshot(state), state.recorded.records.events); wire.drop(); await first.flush!(opened.attemptId); first.dispose();
  const second = createAccountVisualPersistence({ learner: "account:one", store: memory.store, fetch: wire.fetcher }); t.after(second.dispose);
  await second.open("roots-and-factors", { kind: "direct" });
  assert.equal(wire.bodies.length, 2); assert.equal(wire.bodies[0], wire.bodies[1]);
});
test("an earlier network success cannot hide a newer local quota failure", async t => {
  const memory = memoryStore(), wire = transport();
  const service = createAccountVisualPersistence({ learner: "account:one", store: memory.store, fetch: wire.fetcher }); t.after(service.dispose);
  const opened = await service.open("roots-and-factors", { kind: "direct" }), state = createRootsHostedState(opened.attemptId);
  let status = ""; service.subscribe!(opened.attemptId, next => { status = next; });
  await service.save(opened, rootsSnapshot(state), state.recorded.records.events);
  wire.hold(); const flushing = service.flush!(opened.attemptId); await tick();
  const moved = reduceRootsHostedState(state, { type: "root", action: { type: "place", root: 4, revision: 0 } });
  memory.quota(true); await assert.rejects(service.save(opened, rootsSnapshot(moved), moved.recorded.records.events), /quota/);
  memory.quota(false); wire.release(); await flushing;
  assert.match(status, /not safely stored/);
  await service.save(opened, rootsSnapshot(moved), moved.recorded.records.events); await service.flush!(opened.attemptId);
  assert.equal(status, "Saved");
});
test("account-switched requests stop retries without rebinding the durable queue", async t => {
  const memory = memoryStore(), wire = transport(); let requests = 0;
  const switched: typeof fetch = async (input, init) => String(input).endsWith("/open") ? wire.fetcher(input, init)
    : (requests++, Response.json({ code: "VISUAL_SESSION_CONFLICT" }, { status: 409 }));
  const service = createAccountVisualPersistence({ learner: "account:one", store: memory.store, fetch: switched }); t.after(service.dispose);
  const opened = await service.open("roots-and-factors", { kind: "direct" }), state = createRootsHostedState(opened.attemptId);
  await service.save(opened, rootsSnapshot(state), state.recorded.records.events); await service.flush!(opened.attemptId); await service.flush!(opened.attemptId);
  assert.equal(requests, 1); assert.equal([...memory.rows.values()][0].learner, "account:one"); assert.equal([...memory.rows.values()][0].events.length, 1);
});

test("unknown first open offline creates no provisional attempt and retries the same open identity", async t => {
  const memory = memoryStore(), wire = transport(); let offline = true; const ids: string[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    ids.push(JSON.parse(String(init?.body)).visitId);
    if (offline) throw new TypeError("Offline"); return wire.fetcher(input, init);
  };
  const service = createAccountVisualPersistence({ learner: "account:one", store: memory.store, fetch: fetcher }); t.after(service.dispose);
  await assert.rejects(service.open("roots-and-factors", { kind: "direct" }), /Offline/); assert.equal(memory.rows.size, 0);
  offline = false; await service.open("roots-and-factors", { kind: "direct" }); assert.equal(ids[0], ids[1]); assert.equal(memory.rows.size, 1);
});

test("new attempts archive pending work atomically and reject a second request from a stale host", async t => {
  const memory = memoryStore(), wire = transport();
  const service = createAccountVisualPersistence({ learner: "account:one", store: memory.store, fetch: wire.fetcher }); t.after(service.dispose);
  const opened = await service.open("roots-and-factors", { kind: "direct" }), initial = createRootsHostedState(opened.attemptId);
  await service.save(opened, rootsSnapshot(initial), initial.recorded.records.events); wire.offline(true);
  const next = await service.startNewAttempt!(opened);
  assert.equal(next.attemptNumber, 2); assert.notEqual(next.attemptId, opened.attemptId); assert.equal(memory.rows.size, 2);
  const old = [...memory.rows.values()].find(row => row.session.attemptId === opened.attemptId)!;
  assert.equal(old.events.length, 1); assert.equal(old.snapshot?.sequence, 1);
  const fresh = createRootsHostedState(next.attemptId, next.attemptNumber);
  await service.save(next, rootsSnapshot(fresh), fresh.recorded.records.events);
  await assert.rejects(service.startNewAttempt!(opened), /ACTIVE_ATTEMPT_CONFLICT/); assert.equal(memory.rows.size, 2);
  assert.equal([...memory.rows.values()].find(row => row.session.attemptId === next.attemptId)!.command?.request.expectedActiveAttemptId, opened.attemptId);
});

test("a lost new-attempt response retries the same command and registers before its events", async t => {
  const memory = memoryStore(), wire = transport();
  const first = createAccountVisualPersistence({ learner: "account:one", store: memory.store, fetch: wire.fetcher });
  const opened = await first.open("roots-and-factors", { kind: "direct" }), initial = createRootsHostedState(opened.attemptId);
  await first.save(opened, rootsSnapshot(initial), initial.recorded.records.events); await first.flush!(opened.attemptId);
  wire.dropCommand(); const next = await first.startNewAttempt!(opened), fresh = createRootsHostedState(next.attemptId, next.attemptNumber);
  await first.save(next, rootsSnapshot(fresh), fresh.recorded.records.events); await first.flush!(next.attemptId); first.dispose();
  assert.equal(wire.commands.length, 1);
  const second = createAccountVisualPersistence({ learner: "account:one", store: memory.store, fetch: wire.fetcher }); t.after(second.dispose);
  const restored = await second.open("roots-and-factors", { kind: "direct" });
  assert.equal(restored.attemptId, next.attemptId); assert.equal(restored.attemptNumber, 2);
  assert.equal(wire.commands.length, 2); assert.equal(wire.commands[0], wire.commands[1]);
  assert.equal(JSON.parse(wire.bodies.at(-1)!).snapshot.attemptNumber, 2);
});

test("a failed local new-attempt transition preserves the original row", async t => {
  const memory = memoryStore(), wire = transport();
  const service = createAccountVisualPersistence({ learner: "account:one", store: memory.store, fetch: wire.fetcher }); t.after(service.dispose);
  const opened = await service.open("roots-and-factors", { kind: "direct" }); memory.quota(true);
  await assert.rejects(service.startNewAttempt!(opened), /quota/);
  assert.equal(memory.rows.size, 1); assert.equal([...memory.rows.values()][0].session.attemptId, opened.attemptId);
});

test("a stale tab cannot borrow a newer local revision to overwrite the server", async t => {
  const memory = memoryStore(), wire = transport();
  const first = createAccountVisualPersistence({ learner: "account:one", store: memory.store, fetch: wire.fetcher }); t.after(first.dispose);
  const opened = await first.open("roots-and-factors", { kind: "direct" }), initial = createRootsHostedState(opened.attemptId);
  await first.save(opened, rootsSnapshot(initial), initial.recorded.records.events); await first.flush!(opened.attemptId);
  const second = createAccountVisualPersistence({ learner: "account:one", store: memory.store, fetch: wire.fetcher }); t.after(second.dispose);
  const reopened = await second.open("roots-and-factors", { kind: "direct" });
  const newer = reduceRootsHostedState(initial, { type: "root", action: { type: "place", root: 5, revision: 0 } });
  await second.save(reopened, rootsSnapshot(newer), newer.recorded.records.events); await second.flush!(reopened.attemptId);
  const stale = reduceRootsHostedState(initial, { type: "root", action: { type: "place", root: 4, revision: 0 } });
  await assert.rejects(first.save(opened, rootsSnapshot(stale), stale.recorded.records.events), /LOCAL_REVISION_CONFLICT/);
  assert.equal(JSON.parse(wire.bodies.at(-1)!).snapshot.state.root, 5);
});

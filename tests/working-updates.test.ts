import assert from "node:assert/strict";
import { test } from "node:test";
import { PersonalWork } from "../src/lib/cards/personalWork";
import { WorkingCardStore } from "../src/lib/cards/workingCardStore";
import { workingRequest, WorkingRequestError } from "../src/components/decks/updateClient";
import { buildCardLayout } from "../src/components/cards/cardLayout";
import { OptimisticSignalManager } from "../src/lib/OptimisticSignalManager";
import { UpdateButton } from "../src/components/decks/useWorkingUpdates";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
const scope = { userId: "alice", cardIds: ["x"] };
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
const deferred = () => { let resolve!: () => void; const promise = new Promise<void>((ok) => { resolve = ok; }); return { promise, resolve }; };

test("Update waits only for affected actor/Card work, Cancel does not cancel the submitted operation", async () => {
  const work = new PersonalWork(), a = deferred(), b = deferred();
  const save = work.run(scope, "save", () => a.promise);
  const unrelated = work.run({ userId: "bob", cardIds: ["x"] }, "save", () => b.promise);
  const cancel = new AbortController();
  const waiting = work.wait(scope, cancel.signal); cancel.abort(); await assert.rejects(waiting, { name: "AbortError" });
  assert.equal(work.hasWork(scope), true);
  a.resolve(); await save; await work.wait(scope);
  assert.equal(work.hasWork({ userId: "bob", cardIds: ["x"] }), true);
  b.resolve(); await unrelated;
});
test("Update retains failed exact writes for retry and a successful newer field supersedes the failure", async () => {
  const work = new PersonalWork(); let attempts = 0;
  await assert.rejects(work.run(scope, "reflection", async () => { if (++attempts === 1) throw Error("offline"); }));
  await assert.rejects(work.wait(scope), /offline/); await work.retry(scope); await work.wait(scope); assert.equal(attempts, 2);
  await assert.rejects(work.run(scope, "reflection", async () => { throw Error("older"); }));
  await work.run(scope, "reflection", async () => {}); await work.wait(scope);
});
test("Update covers provider upload and attachment, failure is not mistaken for completed work", async () => {
  const work = new PersonalWork(), finish = work.begin(scope, "upload"); let ready = false;
  const waiting = work.wait(scope).then(() => { ready = true; }); await tick(); assert.equal(ready, false);
  finish(); await waiting;
  const failure = work.begin(scope, "upload"); failure(Error("attachment failed"));
  await assert.rejects(work.wait(scope), /attachment failed/);
  const retry = work.begin(scope, "upload"); retry(); await work.wait(scope);
});
test("Update lock blocks new affected writes while unrelated work remains available", async () => {
  const work = new PersonalWork(), unlock = work.lock(scope);
  await assert.rejects(work.run(scope, "save", async () => {}), /wait for Update/);
  assert.throws(() => work.begin(scope, "late-upload"), /wait for Update/);
  await work.run({ userId: "alice", cardIds: ["y"] }, "save", async () => {});
  unlock(); await work.run(scope, "save", async () => {});
});
test("coalesced signal processing remains pending until its final desired reading is committed", async () => {
  const work = new PersonalWork(), first = deferred(), second = deferred(); let calls = 0;
  const manager = new OptimisticSignalManager(async () => { await (++calls === 1 ? first.promise : second.promise); }, () => {});
  manager.getConfirmedSignal("x", "s", 1, 1);
  const a = work.run(scope, "signals", () => manager.setOptimisticReading("x", "s", 3)); await tick();
  const b = work.run(scope, "signals", () => manager.setOptimisticReading("x", "s", 8)); await tick();
  let ready = false; const waiting = work.wait(scope).then(() => { ready = true; }); first.resolve(); await tick();
  assert.equal(calls, 2); assert.equal(ready, false); second.resolve(); await Promise.all([a, b, waiting]);
  assert.equal(manager.getConfirmedSignal("x", "s", 0, 0).rawReading, 8);
});
test("global working snapshots never downgrade adoption and epochs are actor-isolated", () => {
  const card = buildCardLayout({ id: "x", label: "Card 1", adoptedVersion: 2, targetDate: "2026-10-11", intro: { title: "Current", description: "", mediaItem: null }, steps: [], signals: [], reflection: "Current reflection", chats: [], mediaItems: [] }, { currentUserId: "alice", users: [] });
  const store = new WorkingCardStore(); store.accept("alice", [card]); store.accept("alice", [{ ...card, adoptedVersion: 1, reflection: "Old" }]);
  assert.equal(store.personal("alice", "x")!.adoptedVersion, 2); assert.equal(store.personal("alice", "x")!.reflection, "Current reflection");
  store.invalidate("alice"); assert.equal(store.epoch("alice"), 1); assert.equal(store.epoch("bob"), 0);
});
test("working requests bind the initiating actor, preserve stale review information and reject switched sessions", async () => {
  const original = globalThis.fetch; const seen: RequestInit[] = [];
  try {
    globalThis.fetch = async (url, options) => { if (String(url) === "/api/auth/me") return Response.json({ user: { id: "bob" } }); seen.push(options!); return Response.json({ viewerUserId: "alice", review: null }, { headers: { "X-Personal-Viewer": "alice" } }); };
    await assert.rejects(workingRequest("alice", "/review"), (error) => error instanceof WorkingRequestError && error.code === "UPDATE_SESSION_CONFLICT");
    assert.equal((seen[0].headers as Record<string, string>)["X-Personal-Viewer"], "alice");
    const latestReview = { viewerUserId: "alice", review: null };
    globalThis.fetch = async () => Response.json({ code: "UPDATE_REVIEW_CONFLICT", latestReview }, { status: 409 });
    await assert.rejects(workingRequest("alice", "/update", "POST", {}), (error) => error instanceof WorkingRequestError && error.latestReview?.viewerUserId === "alice");
  } finally { globalThis.fetch = original; }
});
test("working Update slot is minimal and keeps the Card action outside normal layout", () => {
  const html = renderToStaticMarkup(createElement(UpdateButton, { card: true, title: "Practice", onClick() {} }));
  assert.match(html, /working-card-update/); assert.match(html, /aria-label="Update Practice"/);
  assert.doesNotMatch(html, /progress|completion|targetDate/);
});

test("failed upload attachment retries the same known asset, while failed transfers require explicit media retry", async () => {
  const work = new PersonalWork(); let attachments = 0;
  const finish = work.begin(scope, "upload");
  finish(Error("attachment failed"), async () => { attachments++; });
  await assert.rejects(work.wait(scope), /attachment failed/); await work.retry(scope); await work.wait(scope);
  assert.equal(attachments, 1);
  const transfer = work.begin(scope, "upload"); transfer(Error("provider failed"));
  await assert.rejects(work.wait(scope), /provider failed/); await assert.rejects(work.retry(scope), /media editor/);
});
test("refresh revisions and transition locks are scoped, including inherited-media writes affecting descendants", async () => {
  const work = new PersonalWork(); const before = work.revision(scope);
  await work.run({ userId: "alice", cardIds: ["unrelated"] }, "save", async () => {}); assert.equal(work.revision(scope), before);
  const hold = deferred(); const deletion = work.run({ userId: "alice", cardIds: ["source", "x"] }, "remove-source-media", () => hold.promise);
  assert.equal(work.hasWork(scope), true); assert.ok(work.revision(scope) > before);
  hold.resolve(); await deletion; await work.wait(scope);
  const unlock = work.lock(scope); assert.equal(work.isLocked(scope), true); unlock(); assert.equal(work.isLocked(scope), false);
});
test("resetting refreshed signal baselines does not remove an unrelated in-flight rollback baseline", async () => {
  const hold = deferred(); let restored: number | null | undefined;
  const manager = new OptimisticSignalManager(async () => { await hold.promise; throw Error("offline"); }, (_card, _signal, state) => { restored = state.rawReading; });
  manager.getConfirmedSignal("x", "s", 4, 4); const writing = manager.setOptimisticReading("x", "s", 7);
  manager.resetConfirmed(); hold.resolve(); await writing; assert.equal(restored, 4);
});

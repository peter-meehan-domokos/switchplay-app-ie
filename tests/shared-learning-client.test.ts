import assert from "node:assert/strict";
import { test } from "node:test";
import { persistSignalReading, persistStepCompletionStatus } from "../src/lib/deckMutations";
import { workingCardStore } from "../src/lib/cards/workingCardStore";

test("confirmed learning writes invalidate only the initiating owner's presentation and notify summary subscribers", async () => {
  const original = globalThis.fetch, actor = "learning-client-owner";
  const before = workingCardStore.epoch(actor), other = workingCardStore.epoch("other-owner"); let notices = 0;
  const unsubscribe = workingCardStore.subscribe(actor, () => { notices++; });
  globalThis.fetch = async (_input, init) => {
    assert.equal(new Headers(init?.headers).get("X-Personal-Viewer"), actor);
    return Response.json({ ok: true }, { headers: { "X-Personal-Viewer": actor } });
  };
  try {
    await persistStepCompletionStatus("deck", "x", "a", "done", actor);
    await persistSignalReading("other-deck", "x", "a", 6.42, actor);
    assert.equal(workingCardStore.epoch(actor), before + 2); assert.equal(notices, 2);
    assert.equal(workingCardStore.epoch("other-owner"), other);
  } finally { unsubscribe(); globalThis.fetch = original; }
});

test("an acknowledgement arriving after session clear cannot refresh or repopulate the new session", async () => {
  const original = globalThis.fetch, actor = "learning-client-old-session";
  let reached!: () => void, release!: () => void;
  const started = new Promise<void>(resolve => { reached = resolve; });
  const held = new Promise<void>(resolve => { release = resolve; });
  globalThis.fetch = async () => { reached(); await held; return Response.json({ ok: true }, { headers: { "X-Personal-Viewer": actor } }); };
  try {
    const write = persistStepCompletionStatus("deck", "x", "a", "done", actor);
    const rejected = assert.rejects(write, /account changed/);
    await started; workingCardStore.clearUser(actor); const epoch = workingCardStore.epoch(actor);
    release(); await rejected;
    assert.equal(workingCardStore.epoch(actor), epoch); assert.equal(workingCardStore.personal(actor, "x"), undefined);
  } finally { release?.(); globalThis.fetch = original; }
});

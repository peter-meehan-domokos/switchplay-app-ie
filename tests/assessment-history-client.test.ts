import assert from "node:assert/strict";
import { test } from "node:test";
import { readAssessmentHistory } from "../src/lib/assessments/historyClient";
import { PersonalWork } from "../src/lib/cards/personalWork";
const empty = { state: "empty", count: 0, readableCount: 0, results: [], latestThree: [], sources: [], issues: [] };
test("history client pins actor and requested identity and preserves explicit partial results/diagnostics", async () => {
  const original = globalThis.fetch;
  const row = { id: "test", source: { kind: "card", cardTemplateId: "original" } };
  let data = { viewerUserId: "actor", cardTemplateId: "fork", history: { ...empty, state: "incomplete", count: null, readableCount: 1, results: [row], issues: [{ code: "MISSING_PERSONAL_HISTORY_SOURCE", cardTemplateId: "ancestor" }] } };
  globalThis.fetch = async (_url, options) => {
    assert.equal((options?.headers as Record<string, string>)["X-Personal-Viewer"], "actor"); assert.equal(options?.cache, "no-store");
    return Response.json(data, { headers: { "X-Personal-Viewer": "actor" } });
  };
  try {
    const result = await readAssessmentHistory("actor", { kind: "card", cardTemplateId: "fork" });
    assert.equal(result.history.results.length, 1); assert.equal(result.history.issues[0].cardTemplateId, "ancestor");
    data = { ...data, viewerUserId: "other" }; await assert.rejects(readAssessmentHistory("actor", { kind: "card", cardTemplateId: "fork" }), /SESSION_CONFLICT/);
    data = { ...data, viewerUserId: "actor", cardTemplateId: "wrong" }; await assert.rejects(readAssessmentHistory("actor", { kind: "card", cardTemplateId: "fork" }), /SESSION_CONFLICT/);
  } finally { globalThis.fetch = original; }
});
test("failed history reads and fabricated latest-three sequences are errors, never empty histories", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => Response.json({ error: "Database unavailable" }, { status: 500, headers: { "X-Personal-Viewer": "actor" } });
    await assert.rejects(readAssessmentHistory("actor", { kind: "item", itemId: "item" }), /Database unavailable/);
    globalThis.fetch = async () => Response.json({ viewerUserId: "actor", itemId: "item", history: { ...empty, state: "incomplete", latestThree: [{ id: "fake", source: { kind: "item", itemId: "item" } }] } }, { headers: { "X-Personal-Viewer": "actor" } });
    await assert.rejects(readAssessmentHistory("actor", { kind: "item", itemId: "item" }), /INVALID_ASSESSMENT_RESPONSE/);
  } finally { globalThis.fetch = original; }
});
test("failure cleanup cannot discard an in-flight operation or newer work occupying the same key", async () => {
  const work = new PersonalWork(), scope = { userId: "actor", cardIds: ["card"] };
  const failed = work.run(scope, "tests", async () => { throw new Error("Conflict"); }); await assert.rejects(failed);
  let release!: () => void; const newer = work.run(scope, "tests", () => new Promise<void>((resolve) => { release = resolve; }));
  await Promise.resolve(); work.discardFailed("actor", "tests", failed); work.discardFailed("actor", "tests", newer);
  assert.equal(work.hasWork(scope), true); release(); await newer; await work.wait(scope);
  const next = work.run(scope, "tests", async () => { throw new Error("Conflict"); }); await assert.rejects(next);
  work.discardFailed("actor", "tests", next); assert.equal(work.hasWork(scope), false); const unlock = work.lock(scope); unlock();
});
test("exact failed-operation retry preserves its intent without replaying unrelated failed work", async () => {
  const work = new PersonalWork(), scope = { userId: "actor", cardIds: ["card"] }; let attempts = 0;
  const failed = work.run(scope, "tests", async () => { if (++attempts === 1) throw new Error("Disconnected"); return 7; });
  await assert.rejects(failed);
  const unrelated = work.run(scope, "upload", async () => { throw new Error("Upload failed"); }); await assert.rejects(unrelated);
  assert.equal(await work.retryFailed("actor", "tests", failed), 7); assert.equal(attempts, 2); assert.equal(work.hasWork(scope), true);
  work.discardFailed("actor", "upload", unrelated); await work.wait(scope);
});

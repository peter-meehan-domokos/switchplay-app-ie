import assert from "node:assert/strict";
import { test } from "node:test";
import { persistAssessment, readPersonalAssessments } from "../src/lib/assessments/client";
import { AssessmentConflict, type AssessmentCommand, type AssessmentList } from "../src/lib/assessments/contracts";
import { personalWork } from "../src/lib/cards/personalWork";
import { workingCardStore } from "../src/lib/cards/workingCardStore";

function setup(actor: string) {
  const source = { kind: "card" as const, cardTemplateId: "source" };
  const command: AssessmentCommand = { viewerUserId: actor, source, id: "test", action: "add", expectedRevision: 0,
    date: "2026-10-11", result: true, deckTemplateId: "deck" };
  const list: AssessmentList = { viewerUserId: actor, source: structuredClone(source), revision: 0, tests: [] };
  const response = (body: unknown, status = 200) => Response.json(body, { status, headers: { "X-Personal-Viewer": actor } });
  return { command, list, response, scope: { userId: actor, cardIds: ["source"] } };
}
async function withFetch(mock: typeof fetch, run: () => Promise<void>) {
  const original = globalThis.fetch; globalThis.fetch = mock;
  try { await run(); } finally { globalThis.fetch = original; }
}
test("lost Add response reconciles by reading persisted source, without duplicate replay, and invalidates working views", async () => {
  const { command, list, response, scope } = setup("lost-add"), methods: string[] = [];
  const epoch = workingCardStore.epoch(command.viewerUserId);
  await withFetch(async (_url, options) => {
    methods.push(options?.method ?? "GET");
    if (options?.method === "POST") {
      list.revision = 1; list.tests = [{ id: "test", date: command.date, result: true, createdAt: "2026-10-11T10:00:00.000Z" }];
      throw new TypeError("Response lost");
    }
    return response(list);
  }, async () => {
    const result = await persistAssessment(command, ["fork"]);
    assert.equal(result.outcome, "already-present"); assert.deepEqual(methods, ["POST", "GET"]);
    assert.equal(workingCardStore.epoch(command.viewerUserId), epoch + 1); await personalWork.wait(scope);
  });
});
test("uncommitted network failure retains original intent; explicit retry reads before replay and respects Update coordination", async () => {
  const { command, list, response, scope } = setup("retry-add"), methods: string[] = []; let fail = true;
  await withFetch(async (_url, options) => {
    methods.push(options?.method ?? "GET");
    if (options?.method === "POST") {
      if (fail) throw new TypeError("Disconnected");
      list.revision = 1; list.tests = [{ id: "test", date: command.date, result: true, createdAt: "2026-10-11T10:00:00.000Z" }];
      return response({ ...list, outcome: "changed" });
    }
    return response(list);
  }, async () => {
    await assert.rejects(persistAssessment(command), /Disconnected/);
    assert.equal(personalWork.hasWork(scope), true); await assert.rejects(personalWork.wait(scope), /could not be saved/);
    assert.throws(() => personalWork.lock(scope), /pending/);
    fail = false; await personalWork.retry(scope); await personalWork.wait(scope);
    assert.deepEqual(methods, ["POST", "GET", "GET", "POST"]); assert.equal(list.tests.length, 1);
  });
});
test("an uncertain Add followed by deletion becomes a refreshable conflict, never a resurrection", async () => {
  const { command, list, response } = setup("deleted-add"); let writes = 0;
  await withFetch(async (_url, options) => {
    if (options?.method === "POST") { writes++; list.revision = 2; throw new TypeError("Response lost after Add and Delete"); }
    return response(list);
  }, async () => {
    await assert.rejects(persistAssessment(command), (error) => error instanceof AssessmentConflict && error.latestList.revision === 2);
    assert.equal(writes, 1); assert.deepEqual(list.tests, []);
  });
});
test("existing personal mutation queue serializes assessments; conflict preserves the later intent instead of rebasing it", async () => {
  const { command, list, response } = setup("queue"); let inFlight = 0, max = 0;
  await withFetch(async (_url, options) => {
    inFlight++; max = Math.max(max, inFlight); await new Promise((resolve) => setTimeout(resolve, 5)); inFlight--;
    const body = JSON.parse(options!.body as string) as AssessmentCommand;
    if (body.expectedRevision !== list.revision) return response({ code: "ASSESSMENT_REVISION_CONFLICT", latestList: list }, 409);
    list.revision = 1; list.tests = [{ id: body.id, date: "2026-10-11", result: true, createdAt: "2026-10-11T10:00:00.000Z" }];
    return response({ ...list, outcome: "changed" });
  }, async () => {
    const results = await Promise.allSettled([persistAssessment(command), persistAssessment({ ...command, id: "second" })]);
    assert.equal(results[0].status, "fulfilled"); assert.equal(results[1].status, "rejected"); assert.equal(max, 1);
    assert.deepEqual(list.tests.map((test) => test.id), ["test"]);
  });
});
test("a fork-context Update lock prevents inherited-source mutation and failed reads never fabricate empty history", async () => {
  const { command, scope } = setup("locked"), unlock = personalWork.lock({ ...scope, cardIds: ["fork"] });
  let calls = 0;
  await withFetch(async () => { calls++; throw new TypeError("Database unavailable"); }, async () => {
    try { await assert.rejects(persistAssessment(command, ["fork"]), /Update/); } finally { unlock(); }
    assert.equal(calls, 0); await assert.rejects(readPersonalAssessments(command.viewerUserId, command.source), /Database unavailable/);
  });
});
test("late read responses bound to another actor or source are rejected", async () => {
  const { command, list, response } = setup("actor");
  await withFetch(async () => response({ ...list, viewerUserId: "another-user" }), async () => {
    await assert.rejects(readPersonalAssessments(command.viewerUserId, command.source), /SESSION_CONFLICT/);
  });
});

test("queued commands retain their original source and result identity if the caller changes its form object", async () => {
  const { command, list, response } = setup("immutable-intent");
  await withFetch(async (url, options) => {
    const body = JSON.parse(options!.body as string);
    assert.equal(url, "/api/cards-data/source/tests"); assert.equal(body.id, "test"); assert.equal(body.source.cardTemplateId, "source");
    return response({ ...list, revision: 1, tests: [{ id: "test", date: "2026-10-11", result: true, createdAt: "2026-10-11T10:00:00.000Z" }], outcome: "changed" });
  }, async () => {
    const pending = persistAssessment(command); command.id = "changed";
    if (command.source.kind === "card") command.source.cardTemplateId = "another-card";
    assert.equal((await pending).tests[0].id, "test");
  });
});

test("assessment invalidation notifies every mounted subscriber for the actor only, including reconciled saves", async () => {
  const { command, list, response } = setup("subscriptions");
  let b = 0, c = 0, stranger = 0;
  const offB = workingCardStore.subscribe(command.viewerUserId, () => b++);
  const offC = workingCardStore.subscribe(command.viewerUserId, () => c++);
  const offOther = workingCardStore.subscribe("other-subscriber", () => stranger++);
  try {
    await withFetch(async (_url, options) => {
      if (options?.method === "POST") { list.revision = 1; list.tests = [{ id: "test", date: "2026-10-11", result: true, createdAt: "2026-10-11T10:00:00Z" }]; throw new TypeError("Lost response"); }
      return response(list);
    }, async () => { await persistAssessment(command); });
    assert.deepEqual([b, c, stranger], [1, 1, 0]);
    offB(); workingCardStore.invalidate(command.viewerUserId);
    assert.deepEqual([b, c, stranger], [1, 2, 0]);
  } finally { offB(); offC(); offOther(); }
});

test("forged conflict lists cannot rebind the assessment actor or storage source", async () => {
  const { command, list, response } = setup("conflict-privacy");
  await withFetch(async (_url, options) => options?.method ? response({ code: "ASSESSMENT_REVISION_CONFLICT", latestList: { ...list, viewerUserId: "other" } }, 409) : response(list), async () => {
    await assert.rejects(persistAssessment(command), /SESSION_CONFLICT/);
  });
});

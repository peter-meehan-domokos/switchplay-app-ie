import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { assertBoundedJson, assertVisualBatch, assertVisualSource, principalKey } from "../src/lib/visualLearningRecords/contracts";
import { createRootsHostedState, rootsSnapshot } from "../src/app/step-visuals/activities/roots-factors/hostState";

const id = randomUUID(), state = createRootsHostedState(id), event = state.recorded.records.events[0];
const batch = { writeId: randomUUID(), expectedStateRevision: 0, visitId: randomUUID(), activityVersion: 1, snapshotSchema: 1,
  snapshot: rootsSnapshot(state), events: [{ eventId: randomUUID(), writerId: randomUUID(), clientSequence: 1, clientOccurredAt: "2026-10-30T12:00:00.000Z",
    activityVersion: 1, eventSchema: 1, type: event.type, payload: event }] };
test("bounded event envelope accepts real activity facts and rejects extra or malformed content", () => {
  assert.doesNotThrow(() => assertVisualBatch(batch, "roots-and-factors", id));
  for (const changed of [
    { ...batch, arbitrary: true }, { ...batch, activityVersion: 2 }, { ...batch, expectedStateRevision: -1 },
    { ...batch, events: Array.from({ length: 101 }, () => batch.events[0]) },
    { ...batch, events: [{ ...batch.events[0], payload: { ...event, text: "unspecified learner content" } }] },
    { ...batch, events: [{ ...batch.events[0], type: "pointer-preview" }] },
    { ...batch, events: [{ ...batch.events[0], payload: { ...event, root: "three" } }] },
    { ...batch, events: [{ ...batch.events[0], clientOccurredAt: "not-a-date" }] },
  ]) assert.throws(() => assertVisualBatch(changed, "roots-and-factors", id));
});
test("hostile JSON, unbounded strings, invalid context and principal collisions are rejected", () => {
  const cycle: Record<string, unknown> = {}; cycle.self = cycle;
  for (const v of [cycle, { n: Infinity }, { s: "x".repeat(4097) }, JSON.parse('{"__proto__":{}}'), { $set: 1 }, { "a.b": 2 }]) assert.throws(() => assertBoundedJson(v));
  assert.throws(() => assertVisualSource({ kind: "direct", url: "https://example.com" }));
  assert.throws(() => assertVisualSource({ kind: "card", cardId: "private" }));
  assert.doesNotThrow(() => assertVisualSource({ kind: "framework", frameworkId: "maths", frameworkItemId: "integration" }));
  assert.notEqual(principalKey({ kind: "guest", id: "one" }), principalKey({ kind: "account", id: "one" }));
  assert.throws(() => principalKey({ kind: "account", id: "guest:one" }));
});

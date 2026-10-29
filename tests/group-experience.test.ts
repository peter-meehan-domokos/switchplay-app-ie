import assert from "node:assert/strict";
import { test } from "node:test";
import { aggregateLearning, followerMetrics, metrics } from "../src/lib/groupExperiences/readModels";
import { createCommand, hash, learningCommand, memberCommand, page } from "../src/lib/groupExperiences/contracts";
import type { LearningFields } from "../src/lib/cards/learning";

const card = (statuses: string[], readings: (number | null)[] = []) => ({ items: statuses.map((completionStatus, i) => ({ stepId: String(i), completionStatus })),
  signalReadings: readings.map((reading, i) => ({ stepId: String(i), reading })) }) as LearningFields;
test("aggregation preserves existing completion semantics and weights raw readings once", () => {
  assert.deepEqual(metrics([]), { completion: null, confidence: null });
  assert.equal(metrics([card(["skipped", "skipped", "skipped"])]).completion, 100);
  assert.equal(metrics([card(["done", "inProgress", "skipped"])]).completion, 50);
  assert.deepEqual(followerMetrics([[card(["done"], [10])], [card(["todo"], [2, 2, 2])]]), { completed: 1, total: 2, confidence: 4 });
  assert.deepEqual(followerMetrics([]), { completed: 0, total: 0, confidence: null });
  assert.deepEqual(followerMetrics([[]]), { completed: 0, total: 1, confidence: null });
  const selected = { cardTemplateId: "x", version: 1, ...card(["done", "skipped", "todo"], [null, null, null]) };
  const result = aggregateLearning([selected], [[selected]]);
  assert.equal(result.followers.completed, 0); assert.equal(result.cards[0].steps[1].followers.completed, 1);
  assert.equal(metrics([card([...Array(199).fill("done"), "todo"])]).completion, 100);
});
test("group commands reject forged owners, extra fields, invalid pages and malformed role operations", () => {
  assert.throws(() => learningCommand({ accessEpoch: 0, version: 1, subjectUserId: "other", change: { kind: "signal", stepId: "a", reading: 4 } }));
  assert.throws(() => memberCommand({ operationId: "x", expectedStructureRevision: 0, targetUserId: "bob", kind: "set-admin", isAdmin: "yes" }));
  assert.throws(() => page(undefined, 101)); assert.throws(() => page(undefined, NaN));
  const input = { operationId: "create", name: " Practice ", adminIds: ["b", "a", "a"], followerIds: ["b", "b"], manifest: { deckTemplateId: "d", deckVersion: 1, cards: [] } };
  assert.deepEqual(createCommand(input).adminIds, ["a", "b"]); assert.equal(createCommand(input).name, "Practice");
  assert.equal(hash({ a: 1, b: 2 }), hash({ b: 2, a: 1 }));
});

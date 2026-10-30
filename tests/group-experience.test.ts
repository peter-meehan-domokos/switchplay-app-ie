import assert from "node:assert/strict";
import { test } from "node:test";
import { aggregateLearning, followerMetrics, metrics } from "../src/lib/groupExperiences/readModels";
import { createCommand, hash, learningCommand, memberCommand, page } from "../src/lib/groupExperiences/contracts";
import type { LearningFields } from "../src/lib/cards/learning";
import { classifyProgress, getProgressPercentage } from "../src/lib/progress";

const card = (statuses: string[], readings: (number | null)[] = []) => ({ items: statuses.map((completionStatus, i) => ({ stepId: String(i), completionStatus })),
  signalReadings: readings.map((reading, i) => ({ stepId: String(i), reading })) }) as LearningFields;
test("neutral skipped scopes and exact completion are distinct from personal percentage presentation", () => {
  assert.deepEqual(metrics([]), { completion: null, confidence: null });
  assert.equal(metrics([card(["skipped", "skipped", "skipped"])]).completion, null);
  assert.equal(getProgressPercentage([{ completionStatus: "skipped" }]), 100);
  assert.equal(classifyProgress([{ completionStatus: "skipped" }]).isComplete, false);
  assert.equal(metrics([card(["done", "inProgress", "skipped"])]).completion, 50);
  assert.deepEqual(followerMetrics([[card(["done"], [10])], [card(["todo"], [2, 2, 2])]]), { done: 1, doing: 0, activeTotal: 2, eligibleTotal: 2, confidence: 4 });
  assert.deepEqual(followerMetrics([]), { done: 0, doing: 0, activeTotal: 0, eligibleTotal: 0, confidence: null });
  assert.deepEqual(followerMetrics([[]]), { done: 0, doing: 0, activeTotal: 1, eligibleTotal: 0, confidence: null });
  const selected = { cardTemplateId: "x", version: 1, ...card(["done", "skipped", "todo"], [null, null, null]) };
  const result = aggregateLearning([selected], [[selected]]);
  assert.equal(result.followers.done, 0); assert.equal(result.followers.doing, 1);
  assert.equal(result.cards[0].steps[1].followers.eligibleTotal, 0);
  const rounded = card([...Array(199).fill("done"), "todo"]);
  assert.equal(metrics([rounded]).completion, 100);
  assert.equal(classifyProgress(rounded.items).isComplete, false);
  assert.equal(followerMetrics([[rounded]]).doing, 1);
});
test("doing/done counts exclude skipped observations, with independent confidence and scope denominators", () => {
  const statuses = ["inProgress", "inProgress", "inProgress", "done", "done", "skipped", ...Array(6).fill("todo")];
  const rows = statuses.map(status => [card([status], [null])]);
  assert.deepEqual(followerMetrics(rows), { activeTotal: 12, eligibleTotal: 11, doing: 3, done: 2, confidence: null });
  assert.deepEqual(followerMetrics([[card(["skipped"], [10])]]), { activeTotal: 1, eligibleTotal: 0, doing: 0, done: 0, confidence: 10 });
  assert.equal(followerMetrics([[card(["done", "skipped"])]]).done, 1);
  assert.equal(followerMetrics([[card(["todo", "todo"])]]).doing, 0);
  const selected = { cardTemplateId: "x", version: 1, ...card(["todo", "todo"], [null, null]) };
  const other = { ...selected, ...card(["skipped", "done"], [null, null]) };
  const result = aggregateLearning([selected], [[selected], [other]]);
  assert.equal(result.cards[0].steps[0].followers.eligibleTotal, 1);
  assert.equal(result.cards[0].steps[1].followers.eligibleTotal, 2);
});
test("group commands reject forged owners, extra fields, invalid pages and malformed role operations", () => {
  assert.throws(() => learningCommand({ accessEpoch: 0, version: 1, subjectUserId: "other", change: { kind: "signal", stepId: "a", reading: 4 } }));
  assert.throws(() => memberCommand({ operationId: "x", expectedStructureRevision: 0, targetUserId: "bob", kind: "set-admin", isAdmin: "yes" }));
  assert.throws(() => page(undefined, 101)); assert.throws(() => page(undefined, NaN));
  const input = { operationId: "create", name: " Practice ", adminIds: ["b", "a", "a"], followerIds: ["b", "b"], manifest: { deckTemplateId: "d", deckVersion: 1, cards: [] } };
  assert.deepEqual(createCommand(input).adminIds, ["a", "b"]); assert.equal(createCommand(input).name, "Practice");
  assert.equal(hash({ a: 1, b: 2 }), hash({ b: 2, a: 1 }));
});

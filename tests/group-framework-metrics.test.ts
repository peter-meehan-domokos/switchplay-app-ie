import assert from "node:assert/strict";
import { test } from "node:test";
import { scopedMetrics, scopedCohortMetrics, type ProgressLearning } from "../src/lib/groupExperiences/progressMetrics";
import type { LearningFields } from "../src/lib/cards/learning";

function person(statuses: LearningFields["items"][number]["completionStatus"][], readings: (number | null)[] = []): ProgressLearning {
  return { cards: new Map([["card", { items: statuses.map((completionStatus, index) => ({ stepId: String(index), completionStatus })),
    signalReadings: readings.map((reading, index) => ({ stepId: String(index), reading })) }]]), issues: [] };
}
test("cohort completion pools eligible observations instead of rounded player percentages", () => {
  const value = scopedCohortMetrics(["card"], "inside", [person(["done", "done", "done"]), person(["todo", "skipped", "skipped"])], false);
  assert.equal(value.completion, 75); assert.equal(value.eligibleCount, 4); assert.equal(value.completedStepCount, 3);
  assert.equal(value.done, 1); assert.equal(value.doing, 0); assert.equal(value.eligibleTotal, 2);
});
test("raw confidence weighting is independent of skipped completion and Admin extrema are per-player scores", () => {
  const players = [person(["skipped"], [1, 1, 10]), person(["skipped"], [10]), person(["skipped"], [null])];
  const value = scopedCohortMetrics(["card"], "inside", players, true);
  assert.equal(value.confidence, 6); assert.equal(value.confidenceMinimum, 4); assert.equal(value.confidenceMaximum, 10);
  assert.equal(value.state, "skipped"); assert.equal(value.completion, null); assert.equal(value.eligibleCount, 0);
  assert.equal(value.done, 0); assert.equal(value.doing, 0);
  const follower = scopedCohortMetrics(["card"], "inside", players, false);
  assert.equal("confidenceMinimum" in follower, false); assert.equal("confidenceMaximum" in follower, false);
});
test("empty, skipped, outside, unstarted and incomplete are distinct", () => {
  assert.equal(scopedCohortMetrics(["card"], "inside", [], true).state, "empty");
  assert.equal(scopedMetrics(["card"], "inside", person(["skipped"])).state, "skipped");
  assert.equal(scopedMetrics(["card"], "outside", person(["done"])).state, "outside");
  assert.equal(scopedMetrics(["card"], "inside", person(["todo"])).state, "unstarted");
  assert.equal(scopedMetrics(["missing"], "inside", person(["done"])).state, "incomplete");
  assert.equal(scopedMetrics(["card"], "unknown", person(["done"])).state, "incomplete");
  assert.equal(scopedMetrics(["card"], "inside", person(["done"], [NaN])).state, "incomplete");
  assert.equal(scopedMetrics(["card"], "inside", person(["broken"] as never)).state, "incomplete");
});
test("rounded 100 is not exact completion and duplicate scoped Cards do not add observations", () => {
  const statuses: LearningFields["items"][number]["completionStatus"][] = Array(200).fill("done"); statuses[0] = "todo";
  const value = scopedMetrics(["card", "card"], "inside", person(statuses));
  assert.equal(value.completion, 100); assert.equal(value.isComplete, false); assert.equal(value.state, "inProgress");
  assert.equal(value.observationCount, 200); assert.equal(value.completedStepCount, 199);
});

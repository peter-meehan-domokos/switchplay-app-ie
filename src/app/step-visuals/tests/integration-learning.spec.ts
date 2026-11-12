import { expect, test } from "@playwright/test";
import { boundaryBounds, canAdvance, canFinish, effectiveRectangleCount, effectiveRegion, initialIntegration, integrationReducer, parseCalculation, type IntegrationAction } from "../activities/integration-area/learning";
import { integrationPresentation } from "../activities/integration-area/presentation";
import { analyseRegion } from "../activities/integration-area/model";
import { act, atStage, check, next } from "./integration-test-helpers";

test("exploration candidates, cancellation, unchanged release and stale owners produce no evidence", () => {
  const initial = initialIntegration("one");
  expect(next(initial).stage).toBe(2);
  const moving = act(act(initial, { type: "begin", boundary: "b", id: 1 }), { type: "preview", id: 1, value: 2.376 });
  expect(effectiveRegion(moving).b).toBe(2.376); expect(moving.region.b).toBe(1); expect(moving.records).toBe(initial.records);
  expect(next(moving)).toBe(moving);
  expect(act(moving, { type: "preview", id: 2, value: 4 })).toBe(moving);
  const cancelled = act(moving, { type: "cancel", id: 1 });
  expect(cancelled.region.b).toBe(1); expect(cancelled.records).toBe(initial.records);
  expect(integrationReducer(cancelled, { type: "commit", revision: moving.revision, id: 1, value: 4 })).toBe(cancelled);
  expect(act(cancelled, { type: "begin", boundary: "b", id: 1 })).toBe(cancelled);
  const unchanged = act(act(cancelled, { type: "begin", boundary: "b", id: 2 }), { type: "commit", id: 2, value: 1 });
  expect(unchanged.records).toBe(initial.records);
  const placed = act(unchanged, { type: "place", boundary: "b", value: 2.36, input: "value" });
  expect(placed.region.b).toBe(2.36);
  expect(placed.records.events.at(-1)).toMatchObject({ type: "boundary-committed", from: 1, to: 2.36 });
});

test("Stage 2 preserves its constant initial state and all integer partition counts", () => {
  let state = atStage(2);
  expect(state).toMatchObject({ part: "refine", function: "flat", rectangles: 4, region: { a: 0, b: 3 } });
  expect(boundaryBounds(state, "b")).toBeNull();
  expect(act(state, { type: "place", boundary: "b", value: 2, input: "value" })).toBe(state);
  expect(act(state, { type: "function", function: "square" })).toBe(state);
  expect(integrationPresentation(state).lines.map(line => line.text)).toEqual(["Estimated area = 6 square units", "Actual area = 6 square units"]);
  state = act(state, { type: "function", function: "rising" });
  for (const rectangles of [1, 3, 7, 16, 53, 128]) state = act(state, { type: "refine", rectangles });
  state = act(state, { type: "function", function: "flat" });
  expect(state.rectangles).toBe(128);
  expect(integrationPresentation(state).note).toContain("fit the constant-height graph exactly");
});

test("rectangle transactions update the effective partition without processing history", () => {
  for (const start of [atStage(2), act(atStage(4), { type: "function", function: "square" })]) {
    const moving = act(act(start, { type: "begin", boundary: "rectangles", source: "range", id: 1 }), { type: "preview", id: 1, value: 128 });
    expect(effectiveRectangleCount(moving)).toBe(128); expect(moving.rectangles).toBe(4); expect(moving.records).toBe(start.records);
    expect(act(moving, { type: "cancel", id: 1 }).records).toBe(start.records);
    const committed = act(moving, { type: "commit", id: 1, value: 64 });
    expect(committed.records.events.at(-1)).toMatchObject({ type: "refinement-changed", rectangles: 64 });
    expect(act(committed, { type: "commit", id: 1, value: 128 })).toBe(committed);
  }
});

test("demonstration is automatic; only its completion records a fact; answer choices are deliberate", () => {
  let state = atStage(3);
  expect(state.function).toBe("flat"); expect(boundaryBounds(state, "b")).toBeNull();
  expect(next(state)).toBe(state); expect(act(state, { type: "predict", multiplier: 4 })).toBe(state);
  const records = state.records;
  state = act(state, { type: "demonstrate", progress: .432 });
  expect(effectiveRegion(state).b).toBeCloseTo(2.864); expect(state.records).toBe(records);
  state = act(state, { type: "demonstrate", progress: 1 });
  expect(state.records.events.at(-1)?.type).toBe("comparison-demonstrated");
  expect(act(state, { type: "predict", multiplier: 3 })).toBe(state);
  state = act(state, { type: "predict", multiplier: 4 });
  expect(state.prediction).toMatchObject({ correct: false, observed: true });
  expect(act(state, { type: "predict", multiplier: 4 })).toBe(state);
  expect(canAdvance(state)).toBe(true);
});

test("Stage 3 replay restores per-function evidence without duplicate predictions or completion facts", () => {
  let state = act(act(act(atStage(3), { type: "function", function: "rising" }), { type: "demonstrate", progress: 1 }), { type: "predict", multiplier: 2 });
  state = act(state, { type: "function", function: "square" });
  state = act(act(state, { type: "demonstrate", progress: 1 }), { type: "predict", multiplier: 8 });
  const count = state.records.current.predictions.length;
  state = act(state, { type: "function", function: "rising" });
  expect(state.demonstration).toBe(0); expect(state.prediction?.multiplier).toBe(2);
  expect(canAdvance(state)).toBe(true); expect(integrationPresentation(state).feedback).toBeNull();
  const records = state.records;
  state = act(state, { type: "demonstrate", progress: .5 });
  expect(state.records).toBe(records);
  state = act(state, { type: "demonstrate", progress: 1 });
  expect(state.records).toBe(records);
  expect(state.records.current.region).toEqual(state.region);
  expect(integrationPresentation(state).feedback).toBe("Not quite. The area actually quadrupled.");
  expect(state.records.current.predictions).toHaveLength(count);
  const restored = act(next(state), { type: "previous" });
  expect(restored).toMatchObject({ stage: 3, demonstration: 1, prediction: { multiplier: 2 } });
});

test("Stage 4 modes and six-stop counts are independent from other stages", () => {
  let state = atStage(4);
  expect(state).toMatchObject({ function: "rising", rectangles: 4, region: { a: 0, b: 3 } });
  expect(canAdvance(state)).toBe(true); expect(boundaryBounds(state, "b")).toBeNull();
  state = act(state, { type: "function", function: "square" });
  expect(act(state, { type: "refine", rectangles: 7 })).toBe(state);
  state = act(state, { type: "refine", rectangles: 128 });
  state = act(act(state, { type: "function", function: "rising" }), { type: "function", function: "square" });
  expect(state.rectangles).toBe(128); expect(state.records.current.assistanceRequested).toBe(false);
});

test("crossing and identical selections stay free and continuously update geometric area", () => {
  let state = atStage(6);
  state = act(act(state, { type: "select", boundary: "top", value: "lower" }), { type: "select", boundary: "bottom", value: "axis" });
  state = act(state, { type: "place", boundary: "b", value: 4, input: "keyboard" });
  expect(analyseRegion(state.region).area).toBeCloseTo(31 / 6, 12);
  state = act(state, { type: "select", boundary: "top", value: "axis" });
  expect(analyseRegion(state.region).area).toBe(0);
  expect(integrationPresentation(state).note).toBe("The two curves are the same, so there is no gap between them. The shaded area is 0.");
  expect(canAdvance(state)).toBe(true); expect(state.records.current.checks).toEqual([]);
});

test("Stage 7 checks are explicit, empty/invalid are not attempts, and incorrect Finish is allowed", () => {
  const initial = atStage(7);
  expect(act(initial, { type: "finish" })).toBe(initial);
  for (const input of ["", " ", "NaN", "5abc", "Infinity", "5/1"]) {
    const state = check(initial, input); expect(state.checked).toBeNull(); expect(canFinish(state)).toBe(false); expect(state.records).toBe(initial.records);
  }
  expect(integrationPresentation(check(initial, "")).feedback).toBe("Enter an area before checking.");
  const checked = check(initial, "6");
  expect(checked.records.completedAttempts).toEqual([]); expect(canFinish(checked)).toBe(true);
  const finished = act(checked, { type: "finish" });
  expect(finished.part).toBe("finished");
  expect(finished.records.completedAttempts[0]).toMatchObject({ area: 5, outcome: "incorrect", successMode: null, finalCalculation: { submitted: 6 } });
  expect(act(finished, { type: "finish" })).toBe(finished);
});

test("editing invalidates Finish without losing historical submissions, including edit then revert", () => {
  let state = check(atStage(7), "5");
  const stale: IntegrationAction = { type: "finish", revision: state.revision };
  state = act(state, { type: "draft", value: "6" });
  expect(state.feedback).toBeNull(); expect(canFinish(state)).toBe(false);
  expect(integrationReducer(state, stale)).toBe(state); expect(act(state, { type: "finish" })).toBe(state);
  state = act(state, { type: "draft", value: "5" });
  expect(canFinish(state)).toBe(false);
  expect(state.records.current.checks.map(c => c.submitted)).toEqual([5]);
  state = check(state, "6");
  expect(canFinish(state)).toBe(true);
  state = act(state, { type: "finish" });
  expect(state.records.completedAttempts[0].finalCalculation.submitted).toBe(6);
  expect(state.records.current.checks.map(c => c.submitted)).toEqual([5, 6]);
});

test("changes to free choices invalidate the current answer but preserve assistance and history", () => {
  let state = act(check(atStage(7), "99"), { type: "help" });
  expect(state.records.current.assistanceRequested).toBe(true);
  state = act(state, { type: "interval", a: 0, b: 2 });
  state = act(state, { type: "interval", a: 1, b: 2 });
  expect(state).toMatchObject({ draft: "", checked: null, feedback: null, helpOpen: false });
  state = act(check(state, "5"), { type: "finish" });
  expect(state.records.completedAttempts[0].successMode).toBe("assisted");
  const independent = act(check(check(atStage(7), "0"), "5"), { type: "finish" });
  expect(independent.records.completedAttempts[0].successMode).toBe("independent");
});

test("restart archives completed and partial records; explicit exit delivers truthful evidence", () => {
  let state = act(check(atStage(7), "5"), { type: "finish" });
  const result = state.records.completedAttempts[0];
  state = act(state, { type: "restart", attemptId: "second" });
  expect(state.records.completedAttempts[0]).toBe(result); expect(state.stage).toBe(1); expect(state.region.b).toBe(1);
  state = act(state, { type: "place", boundary: "b", value: 3.4, input: "value" });
  state = act(state, { type: "restart", attemptId: "third" });
  expect(state.records.partialAttempts[0]).toMatchObject({ attemptId: "second", status: "restarted", region: { b: 3.4 } });
  expect(act(state, { type: "restart", attemptId: "second" })).toBe(state);
  state = act(state, { type: "exit" });
  expect(state.records.exited).toBe(true);
  expect(state.records.partialAttempts.at(-1)?.status).toBe("exited");
  expect(state.records.events.map(e => e.sequence)).toEqual(state.records.events.map((_, i) => i + 1));
  expect(new Set(state.records.events.map(e => e.eventId)).size).toBe(state.records.events.length);
});

test("records and canonical selections are immutable, serialisable, versioned and bypassed during previews", () => {
  const state = atStage(5), moving = act(act(state, { type: "begin", id: 1, boundary: "b" }), { type: "preview", id: 1, value: 2.4321 });
  expect(moving.records).toBe(state.records);
  expect(state.records.current).toMatchObject({ schemaVersion: 2, activityVersion: 2, stage: 5, stageId: "fixed-exclusion" });
  expect(Object.isFrozen(state.region.curves)).toBe(true); expect(Object.isFrozen(state.records.current.checks)).toBe(true);
  expect(JSON.parse(JSON.stringify(state.records))).toEqual(state.records);
  expect(integrationReducer(state, { type: "next", revision: state.revision }, false)).toBe(state);
});

test("calculation parser and tolerance accept equivalent finite numbers, not rounded wrong answers", () => {
  for (const input of ["", " ", "5abc", "5/1", "NaN", "Infinity", "1e999", "−5"]) expect(parseCalculation(input)).toBeNull();
  for (const input of ["5", "+5.0", "5e0", " 5 "]) expect(parseCalculation(input)).toBe(5);
  expect(parseCalculation("-0")).toBe(0);
  expect(check(atStage(7), "5.0000000001").checked?.correct).toBe(true);
  expect(check(atStage(7), "5.01").checked?.correct).toBe(false);
});

import { expect, test } from "@playwright/test";
import { effectiveRegion, integrationReducer, type IntegrationAction } from "../activities/integration-area/learning";
import { analyseRegion, areaBetween, orderedRegion, type IntegrationFunction } from "../activities/integration-area/model";
import { laterMathLayout, mathDescription, trianglePresentation } from "../activities/integration-area/math-presentation";
import { act, atStage, check, next, previous } from "./integration-test-helpers";

test("only Stage 5 has continuous settlement, cancellation and one final integer event", () => {
  let state = atStage(5);
  const records = state.records;
  state = act(act(state, { type: "begin", id: 1, boundary: "b" }), { type: "preview", id: 1, value: 2.36 });
  state = act(state, { type: "release", id: 1, value: 2.34 });
  expect(state.region).toMatchObject({ a: 1, b: 3 }); expect(state.edit).toMatchObject({ candidate: 2.34, settleTo: 2 });
  const stale: IntegrationAction = { type: "commit", revision: state.revision, id: 1, value: 2 };
  state = act(state, { type: "preview", id: 1, value: 2.1 });
  expect(effectiveRegion(state).b).toBe(2.1); expect(state.records).toBe(records);
  const cancelled = act(state, { type: "suspend" });
  expect(cancelled.region.b).toBe(3); expect(integrationReducer(cancelled, stale)).toBe(cancelled);
  const committed = act(state, { type: "commit", id: 1, value: 2 });
  expect(committed.region).toEqual({ curves: ["rising", "axis"], a: 1, b: 2 });
  expect(committed.records.events).toHaveLength(records.events.length + 1);
  expect(act(committed, { type: "commit", id: 1, value: 1 })).toBe(committed);
  for (const start of [atStage(1), atStage(6)]) {
    const continuous = act(act(start, { type: "begin", id: 1, boundary: "b" }), { type: "release", id: 1, value: 2.3467 });
    expect(continuous.region.b).toBe(2.3467); expect(continuous.edit).toBeNull();
  }
});

test("all exploratory pairs, reversals, crossing and zero-width selections are mathematically truthful", () => {
  for (const first of ["rising", "lower", "axis"] as IntegrationFunction[]) for (const second of ["rising", "lower", "axis"] as IntegrationFunction[]) for (const b of [1, 3, 3.0001, 4]) {
    let state = atStage(6);
    state = act(act(state, { type: "select", boundary: "top", value: first }), { type: "select", boundary: "bottom", value: second });
    state = act(state, { type: "place", boundary: "b", value: b, input: "value" });
    expect(state.region.curves).toEqual([first, second]);
    const analysis = analyseRegion(state.region), reversed = analyseRegion({ ...state.region, curves: [second, first] });
    expect(analysis.area).toBe(reversed.area); expect(analysis.area).toBeGreaterThanOrEqual(0);
    expect(state.records.current.checks).toEqual([]);
  }
  expect(() => orderedRegion("upper", "parabola", 1, 3)).toThrow(/cross/);
});

test("exact triangle values, causal copy and removed area remain invariant during movement", () => {
  for (const [b, whole, desired] of [[1, .5, 0], [2, 2, 1.5], [3, 4.5, 4], [4, 8, 7.5]]) {
    const triangles = trianglePresentation(b);
    expect(triangles[0].label).toBe("First, the whole triangle from 0 to " + b + " has area:");
    expect(triangles[1].label).toBe("But we start at 1, so we leave out this small triangle:");
    expect(triangles[2].label).toBe("So the shaded area we want is:");
    expect(mathDescription(triangles[1].expression)).toContain("1 over 2");
    expect(whole - .5).toBe(desired); expect(areaBetween("rising", "axis", 1, b)).toBe(desired);
  }
  const moving = act(act(atStage(5), { type: "begin", id: 1, boundary: "b" }), { type: "preview", id: 1, value: 2.3467 });
  expect(mathDescription(laterMathLayout(moving).triangles[0].expression)).toContain("b × b");
  expect(mathDescription(laterMathLayout(moving).triangles[0].expression)).toContain("≈");
});

test("all 27 final curve/interval combinations assess the generated region, including zero", () => {
  const functions = ["upper", "parabola", "axis"] as const;
  const answers = [[[0, 9, 10], [9, 0, 1], [10, 1, 0]], [[0, 5, 12], [5, 0, 7], [12, 7, 0]], [[0, 14, 22], [14, 0, 8], [22, 8, 0]]];
  for (const [k, [a, b]] of ([[0, 1], [1, 2], [0, 2]] as const).entries()) for (const [i, first] of functions.entries()) for (const [j, second] of functions.entries()) {
    let state = atStage(7);
    state = act(act(state, { type: "select", boundary: "top", value: first }), { type: "select", boundary: "bottom", value: second });
    state = act(state, { type: "interval", a, b });
    state = act(check(state, String(answers[k][i][j])), { type: "finish" });
    expect(state.records.completedAttempts[0]).toMatchObject({ area: answers[k][i][j], outcome: "correct", successMode: "independent", region: { curves: [first, second], a, b } });
  }
});

test("reversing a checked pair clears it; outer navigation preserves the new valid problem", () => {
  let state = check(atStage(7), "5");
  state = act(act(state, { type: "select", boundary: "top", value: "parabola" }), { type: "select", boundary: "bottom", value: "upper" });
  expect(state.draft).toBe(""); expect(state.checked).toBeNull();
  state = check(state, "5");
  const restored = next(previous(state));
  expect(restored.region.curves).toEqual(["parabola", "upper"]); expect(restored.checked).toBe(state.checked);
  expect(state.records.current.checks).toHaveLength(2);
});

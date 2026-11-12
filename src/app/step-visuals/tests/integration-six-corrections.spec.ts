import { expect, test } from "@playwright/test";
import { integrationPresentation } from "../activities/integration-area/presentation";
import { laterMathLayout, workedAreaLayout } from "../activities/integration-area/math-presentation";
import { analyseRegion } from "../activities/integration-area/model";
import { STAGE_THREE_START_DELAY_MS, STAGE_THREE_ANIMATION_DURATION_MS } from "../activities/integration-area/use-stage-motion";
import { act, atStage, check, next, previous } from "./integration-test-helpers";

test("constant rectangle conclusion appends the exact second-graph prompt; animation changes delay only", () => {
  expect(integrationPresentation(atStage(2)).note).toBe("The rectangles fit the constant-height graph exactly at every width. What about when y = x?");
  expect(integrationPresentation(act(atStage(2), { type: "function", function: "rising" })).note).toBe("Narrower rectangles follow the rising line more closely, so the estimated area approaches the actual area.");
  expect(STAGE_THREE_START_DELAY_MS).toBe(2140); expect(STAGE_THREE_ANIMATION_DURATION_MS).toBe(900);
});

test("Stage 5 fresh entry uses b3; both navigation directions preserve an intentionally changed boundary", () => {
  let state = atStage(5);
  expect(state.region).toEqual({ curves: ["rising", "axis"], a: 1, b: 3 });
  expect(state.records.events.at(-1)).toMatchObject({ type: "stage-changed", view: { region: { a: 1, b: 3 } } });
  state = act(state, { type: "place", boundary: "b", value: 2, input: "keyboard" });
  expect(previous(next(state)).region.b).toBe(2);
  expect(next(previous(state)).region.b).toBe(2);
  state = act(state, { type: "restart", attemptId: "fresh-b3" });
  while (state.stage < 5) {
    if (state.stage === 3) state = act(act(state, { type: "demonstrate", progress: 1 }), { type: "predict", multiplier: 2 });
    state = next(state);
  }
  expect(state.region.b).toBe(3);
});

test("all Stage 6 pair orders substitute the non-negative height, including existing absolute-value crossing notation", () => {
  const curves = ["rising", "lower", "axis"] as const;
  for (const first of curves) for (const second of curves) for (const b of [1, 2, 3, 3.25, 4]) {
    const state = act(act(act(atStage(6), { type: "select", boundary: "top", value: first }), { type: "select", boundary: "bottom", value: second }), { type: "place", boundary: "b", value: b, input: "value" });
    const expected = first === second ? "0" : first !== "axis" && second !== "axis" ? "4x − x²"
      : first === "rising" || second === "rising" ? "x" : b > 3 ? "|x² − 3x|" : "3x − x²";
    expect(integrationPresentation(state).integral).toMatchObject({ a: "a", b: "b", integrand: expected });
    expect(integrationPresentation(state).integral!.parentheses).toBe(expected === "4x − x²" || expected === "3x − x²");
  }
  expect(analyseRegion({ curves: ["lower", "axis"], a: 1, b: 4 }).area).toBeCloseTo(31 / 6, 12);
});

test("the initial worked solution contains the exact four prescribed mathematical steps", () => {
  expect(workedAreaLayout({ curves: ["upper", "parabola"], a: 1, b: 2 })).toEqual({
    a: "1", b: "2", integrated: "9x + x² − x³",
    substitution: "(9 × 2 + 2² − 2³) − (9 × 1 + 1² − 1³)",
    subtraction: "14 − 9 = 5", upperValue: 14, lowerValue: 9, area: 5,
  });
});

test("worked algebra and both evaluations are correct for all 27 final pair/interval combinations", () => {
  const curves = ["upper", "parabola", "axis"] as const;
  // Independent primitive values at integer boundaries, not calls to the layout's primitive helper.
  const values = { upper: [0, 10, 22], parabola: [0, 1, 8], axis: [0, 0, 0] } as const;
  const primitives = { "upper/parabola": "9x + x² − x³", "upper/axis": "9x + x²", "parabola/axis": "x³" };
  for (const first of curves) for (const second of curves) for (const [a, b] of [[0, 1], [1, 2], [0, 2]]) {
    const ordered = [first, second].sort((left, right) => curves.indexOf(left) - curves.indexOf(right));
    const upperValue = values[ordered[0]][b] - values[ordered[1]][b];
    const lowerValue = values[ordered[0]][a] - values[ordered[1]][a];
    const area = upperValue - lowerValue;
    const scene = workedAreaLayout({ curves: [first, second], a, b });
    expect(scene).toMatchObject({ integrated: first === second ? "0" : primitives[ordered.join("/") as keyof typeof primitives], upperValue, lowerValue, area, subtraction: `${upperValue} − ${lowerValue} = ${area}` });
    expect(workedAreaLayout({ curves: [second, first], a, b })).toEqual(scene);
    let state = act(act(act(atStage(7), { type: "select", boundary: "top", value: first }), { type: "select", boundary: "bottom", value: second }), { type: "interval", a, b });
    expect(laterMathLayout(state).worked).toBeNull();
    state = check(state, String(area)); expect(laterMathLayout(state).worked).toBeNull();
    state = act(state, { type: "finish" }); expect(laterMathLayout(state).worked).toEqual(scene);
    expect(state.records.completedAttempts[0].finalCalculation.expected).toBe(area);
  }
});

test("zero areas remain honest calculations and unsupported worked families fail explicitly", () => {
  expect(workedAreaLayout({ curves: ["upper", "parabola"], a: 1, b: 1 })).toMatchObject({ substitution: "(9 × 1 + 1² − 1³) − (9 × 1 + 1² − 1³)", subtraction: "9 − 9 = 0" });
  expect(workedAreaLayout({ curves: ["axis", "axis"], a: 0, b: 2 })).toMatchObject({ integrated: "0", substitution: "(0) − (0)", subtraction: "0 − 0 = 0" });
  expect(() => workedAreaLayout({ curves: ["lower", "axis"], a: 1, b: 4 })).toThrow();
  expect(() => workedAreaLayout({ curves: ["upper", "axis"], a: 0, b: 3 })).toThrow();
});

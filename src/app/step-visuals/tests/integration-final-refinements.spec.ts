import { expect, test } from "@playwright/test";
import { initialIntegration, integrationReducer, canAdvance } from "../activities/integration-area/learning";
import { integrationPresentation } from "../activities/integration-area/presentation";
import { mathDescription, powerRuleScenes } from "../activities/integration-area/math-presentation";
import { act, atStage, next, previous } from "./integration-test-helpers";

test("initial and restarted attempts explicitly identify the first displayed graph", () => {
  const initial = initialIntegration("initial-view");
  const expected = { type: "attempt-started", view: { region: { curves: ["flat", "axis"], a: 0, b: 1 } } };
  expect(initial.records.events[0]).toMatchObject(expected);
  const restarted = act(initial, { type: "restart", attemptId: "second-view" });
  expect(restarted.records.events.slice(-2).map(event => event.type)).toEqual(["attempt-restarted", "attempt-started"]);
  expect(restarted.records.events.at(-1)).toMatchObject({ ...expected, attemptNumber: 2 });
  expect(restarted.records.events.map(event => event.sequence)).toEqual([1, 2, 3]);
  const latest = restarted.records.events.at(-1)!;
  expect(latest.type).toBe("attempt-started");
  if (latest.type === "attempt-started") expect(Object.isFrozen(latest.view)).toBe(true);
});

test("arrival context reports actual restored graphs and the rule subsection", () => {
  let state = atStage(3);
  expect(state.records.events.at(-1)).toMatchObject({ type: "stage-changed", view: { subsection: "flat", region: { curves: ["flat", "axis"], b: 2 } } });
  state = act(act(act(state, { type: "function", function: "square" }), { type: "demonstrate", progress: 1 }), { type: "predict", multiplier: 8 });
  state = previous(state);
  expect(state.records.events.at(-1)).toMatchObject({ view: { subsection: "flat", region: { curves: ["flat", "axis"], b: 3 } } });
  state = next(state);
  expect(state.records.events.at(-1)).toMatchObject({ view: { subsection: "square", region: { curves: ["square", "axis"], b: 4 } } });
  state = act(next(state), { type: "division-subsection", subsection: "rule" });
  state = previous(next(state));
  expect(state.divisionSubsection).toBe("rule");
  expect(state.records.events.at(-1)).toMatchObject({ type: "stage-changed", direction: "previous", view: { subsection: "rule", region: { curves: ["rising", "axis"], a: 0, b: 3 } } });
  expect(state.records.events.filter(event => event.type === "division-rule-viewed")).toHaveLength(1);
});

test("rule visits and graph returns are accepted selections, not assessments or duplicate clicks", () => {
  let state = act(act(atStage(4), { type: "division-subsection", subsection: "square" }), { type: "refine", rectangles: 128 });
  const region = state.region;
  state = act(state, { type: "division-subsection", subsection: "rule" });
  expect(state.region).toEqual(region); expect(state.rectangles).toBe(128); expect(canAdvance(state)).toBe(true);
  expect(state.records.events.at(-1)?.type).toBe("division-rule-viewed");
  expect(act(state, { type: "division-subsection", subsection: "rule" })).toBe(state);
  expect(act(state, { type: "refine", rectangles: 4 })).toBe(state);
  expect(act(state, { type: "begin", boundary: "rectangles", id: 1 })).toBe(state);
  expect(integrationReducer(state, { type: "division-subsection", subsection: "square", revision: state.revision - 1 })).toBe(state);
  state = act(state, { type: "division-subsection", subsection: "square" });
  expect(state.records.events.at(-1)).toMatchObject({ type: "division-mode-selected", function: "square" });
  expect(state.rectangles).toBe(128);
  state = act(act(state, { type: "division-subsection", subsection: "rising" }), { type: "division-subsection", subsection: "rule" });
  expect(state.records.events.filter(event => event.type === "division-rule-viewed")).toHaveLength(2);
  expect(state.records.current.assistanceRequested).toBe(false); expect(state.records.current.checks).toEqual([]);
});

test("subsection changes cannot interrupt an active rectangle transaction", () => {
  const state = act(act(atStage(4), { type: "division-subsection", subsection: "square" }), { type: "begin", boundary: "rectangles", id: 1 });
  expect(act(state, { type: "division-subsection", subsection: "rule" })).toBe(state);
});

test("returning to an unfinished comparison records its actually displayed region without recording frames", () => {
  const initial = atStage(3);
  const moving = act(initial, { type: "demonstrate", progress: .5 });
  expect(moving.records).toBe(initial.records);
  const restored = next(previous(moving));
  expect(restored.demonstration).toBe(.5);
  expect(restored.records.events.at(-1)).toMatchObject({ type: "stage-changed", view: { subsection: "flat", region: { curves: ["flat", "axis"], a: 0, b: 3 } } });
});

test("all six graph-answer orders produce only the approved contextual conclusions", () => {
  const orders = [["flat", "rising", "square"], ["flat", "square", "rising"], ["rising", "flat", "square"], ["rising", "square", "flat"], ["square", "flat", "rising"], ["square", "rising", "flat"]] as const;
  for (const order of orders) {
    let state = atStage(3);
    for (const kind of order) {
      state = act(act(act(state, { type: "function", function: kind }), { type: "demonstrate", progress: 1 }), { type: "predict", multiplier: 2 });
      const unanswered = (["flat", "rising", "square"] as const).find(value => !state.comparisons[value]?.prediction);
      const expected = !unanswered ? "We've seen how differently the areas grow. Next, we'll see why we divide by 2 or 3 when calculating them."
        : kind === "flat" && unanswered === "rising" ? "Now try y = x. Does the area grow in the same way?"
        : kind === "rising" && unanswered === "square" ? "Now try y = x². Does the area grow even faster?"
        : `Now try ${{ flat: "y = 2", rising: "y = x", square: "y = x²" }[unanswered]}.`;
      expect(integrationPresentation(state).transition).toBe(expected);
    }
    expect(state.records.current.predictions).toHaveLength(3);
    const count = state.records.events.length;
    state = act(state, { type: "function", function: order[0] });
    expect(integrationPresentation(state).transition).toBeUndefined(); expect(canAdvance(state)).toBe(true);
    state = act(state, { type: "demonstrate", progress: 1 });
    expect(state.records.events).toHaveLength(count + 1);
  }
});

test("prepared indefinite identities are distinct from the symbolic definite area", () => {
  expect(mathDescription(powerRuleScenes.linear.primitive)).toBe("x² over 2  + C");
  expect(mathDescription(powerRuleScenes.quadratic.primitive)).toBe("x³ over 3  + C");
  expect(powerRuleScenes.general).toEqual({ integrand: "xⁿ", primitive: [{ numerator: "xⁿ⁺¹", denominator: "n + 1" }, { text: " + C" }] });
  const rule = integrationPresentation(act(atStage(4), { type: "division-subsection", subsection: "rule" }));
  expect(rule.instruction).toBe("Compare the two area formulas to see the pattern behind the power rule for integration.");
  expect(rule.paragraphs).toEqual(["These examples show the pattern: increase the power by one, then divide by that new power.", "We'll explore the constant C in the next stage."]);
  expect(integrationPresentation(atStage(6)).integral).toMatchObject({ a: "a", b: "b", integrand: "4x − x²", parentheses: true });
});

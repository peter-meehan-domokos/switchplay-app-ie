import { expect, test } from "@playwright/test";
import { integrationPresentation } from "../activities/integration-area/presentation";
import { laterMathLayout } from "../activities/integration-area/math-presentation";
import { act, atStage, check, next } from "./integration-test-helpers";

test("all nine growth choices use exact locked feedback and first-answer ownership", () => {
  const initial = atStage(3);
  expect(integrationPresentation(initial)).toMatchObject({ heading: "3. How area grows", instruction: "Watch the width change from 2 to 4." });
  expect(integrationPresentation(initial).choices.map(x => x.label)).toEqual(["It doubled", "It quadrupled", "It increased eightfold"]);
  for (const kind of ["flat", "rising", "square"] as const) for (const multiplier of [2, 4, 8]) {
    let state = act(initial, { type: "function", function: kind });
    state = act(act(state, { type: "demonstrate", progress: 1 }), { type: "predict", multiplier });
    expect(act(state, { type: "predict", multiplier: 4 })).toBe(state);
    const correct = multiplier === ({ flat: 2, rising: 4, square: 8 })[kind];
    const result = ({ flat: "doubled", rising: "quadrupled", square: "increased eightfold" })[kind];
    expect(integrationPresentation(state).feedback).toBe(correct ? "Correct! The area " + result + "." : "Not quite. The area actually " + result + ".");
    expect(next(state).stage).toBe(4);
    if (kind === "square") {
      expect(integrationPresentation(state).paragraphs).toEqual(["The width doubled from 2 to 4.", "But for y = x², doubling x makes the corresponding height four times as large.", "So the whole region is twice as wide and four times as tall: 2 × 4 = 8.", "The area is eight times as large."]);
      expect(laterMathLayout(state).comparison).toEqual([]);
    }
    expect(integrationPresentation(state).transition).toBe(kind === "flat" ? "Now try y = x. Does the area grow in the same way?" : "Now try y = 2.");
  }
});

test("new division modes, fixed exclusion and crossing explanations use approved words", () => {
  expect(integrationPresentation(atStage(4)).instruction).toBe("See how the diagonal divides the rectangle in half. Then tap y = x² to compare.");
  const square = integrationPresentation(act(atStage(4), { type: "function", function: "square" }));
  expect(square.instruction).toBe("Move the slider towards Narrower. Watch the estimates of the area under the graph get closer together.");
  expect(square.note).toBe("The estimates approach 9. That's one-third of the whole rectangle, which has area 27 (as you can see on the graph).");
  expect(integrationPresentation(atStage(5)).instruction).toBe("We've found the area starting at 0. But what if we start at 1 instead?");
  let state = act(act(atStage(6), { type: "select", boundary: "top", value: "axis" }), { type: "select", boundary: "bottom", value: "lower" });
  state = act(state, { type: "place", boundary: "b", value: 4, input: "value" });
  expect(integrationPresentation(state).note).toBe("The curves cross at x = 3. The curve on top changes there, so we add the areas on both sides.");
});

test("final integral is immediate and unsolved; feedback and hints use exact approved wording", () => {
  let state = atStage(7);
  expect(integrationPresentation(state)).toMatchObject({ heading: "7. Choose and calculate an area", instruction: "Choose two curves and an interval. Then calculate the shaded area.", integral: { a: "1", b: "2", integrand: "9 + 2x − 3x²" } });
  expect(integrationPresentation(check(state, "")).feedback).toBe("Enter an area before checking.");
  expect(integrationPresentation(check(state, "6")).feedback).toBe("Not quite. Try calculating the area again.");
  expect(integrationPresentation(check(state, "5")).feedback).toBe("Correct! The shaded area is 5 square units.");
  expect(integrationPresentation(state).hint).toBe("Use the power rule to integrate each term. Then subtract the lower value from the upper value.");
  state = act(state, { type: "select", boundary: "bottom", value: "upper" });
  expect(integrationPresentation(state).hint).toBe("The two curves are the same, so the height between them is 0 everywhere.");
});

import { expect, test } from "@playwright/test";
import { initialLearning, learningReducer, learningInputPolicy, type LearningState, type PredictionChoice } from "../activities/roots-factors/learning";
import { guidedPresentation, promptSizingScenes } from "../activities/roots-factors/presentationLayouts";
import { rootsFactorsLayout } from "../activities/roots-factors/rootsFactorsLayout";

const place = (state: LearningState, root: number) => learningReducer(state, { type: "root", action: { type: "place", revision: state.manipulation.revision, root } });
const ready = (state: LearningState) => learningReducer(state, { type: "ready", revision: state.manipulation.revision });
const predict = (state: LearningState, choice: PredictionChoice) => learningReducer(state, { type: "predict", revision: state.manipulation.revision, choice });
const rootEvent = (state: LearningState, type: "start" | "preview" | "commit" | "cancel", root = 3) => learningReducer(state, { type: "root", action: { type, root, revision: state.manipulation.revision, sessionId: 1 } });

test("only genuinely changed committed placements enable explicit prediction", () => {
  const initial = initialLearning();
  expect(ready(initial)).toBe(initial);
  expect(ready(place(initial, 3))).toEqual(initial);
  const started = rootEvent(initial, "start");
  const transient = rootEvent(started, "preview", 4.2);
  expect(transient.manipulation.hasChangedPlacement).toBe(false);
  expect(ready(transient)).toBe(transient);
  expect(rootEvent(transient, "cancel").manipulation.hasChangedPlacement).toBe(false);
  const returned = rootEvent(transient, "preview", 3);
  expect(rootEvent(returned, "commit", 3).manipulation.hasChangedPlacement).toBe(false);
  expect(rootEvent(transient, "commit", 3.49).manipulation.hasChangedPlacement).toBe(false);
  const changed = rootEvent(transient, "commit", 3.6);
  expect(changed.manipulation.math.movingRoot).toBe(4);
  expect(changed.lesson.stage).toBe("orientation");
  expect(ready(changed).lesson.stage).toBe("prediction");
  expect(initial.manipulation.math.movingRoot).toBe(3);
});

test("an eligible learner cannot advance during a later active drag", () => {
  const eligible = place(initialLearning(), 5);
  const editing = rootEvent(eligible, "start");
  expect(ready(editing)).toBe(editing);
  const cancelled = rootEvent(editing, "cancel");
  expect(cancelled.manipulation.hasChangedPlacement).toBe(true);
  expect(ready(cancelled).lesson.stage).toBe("prediction");
});

test("prediction and movement preserve the chosen orientation root and capture only one choice", () => {
  for (const root of [0, 1, 2, 4, 5]) {
    const pending = ready(place(initialLearning(), root));
    expect(pending.manipulation.math.movingRoot).toBe(root);
    expect(learningInputPolicy(pending.lesson)).toEqual({ enabled: false, bounds: [0, 5] });
    expect(place(pending, -3)).toBe(pending);
    const movement = predict(pending, "minus");
    expect(movement.manipulation.math.movingRoot).toBe(root);
    expect(movement.lesson).toEqual({ stage: "reveal-position", prediction: "minus" });
    expect(learningInputPolicy(movement.lesson)).toEqual({ enabled: true, bounds: [-5, 5] });
    expect(predict(movement, "plus")).toBe(movement);
    expect(place(movement, -2).lesson).toEqual(movement.lesson);
  }
});

for (const choice of ["minus", "plus"] as const) {
  test(`choice ${choice}: only settling at −3 reveals the appropriate explanation`, () => {
    const movement = predict(ready(place(initialLearning(), 4)), choice);
    const started = rootEvent(movement, "start");
    const passing = rootEvent(started, "preview", -3);
    expect(passing.lesson.stage).toBe("reveal-position");
    expect(passing.manipulation.math.movingRoot).toBe(4);
    const nearby = rootEvent(passing, "preview", -2.8);
    const presentation = guidedPresentation(nearby.lesson, true, true, true);
    const scene = rootsFactorsLayout({ movingRoot: -2.8 }, { width: 366, height: 400 }, presentation.policy);
    expect(scene.displayRoot).toBe(-3);
    expect(scene.expression.factors[1].text).toBe("( ? )");
    expect(scene.graph.accessibleDescription).not.toContain("(x + 3)");
    const cancelled = rootEvent(passing, "cancel");
    expect(cancelled.lesson.stage).toBe("reveal-position");
    const revealed = rootEvent(nearby, "commit", -2.8);
    expect(revealed.manipulation.math.movingRoot).toBe(-3);
    expect(revealed.lesson).toEqual({ stage: "reveal-explanation", prediction: choice });
    const prompt = guidedPresentation(revealed.lesson, true, false, true).prompt;
    expect(prompt.comparison.map((row) => row.substitution)).toEqual(choice === "minus" ? ["−3 − 3 = −6", "−3 + 3 = 0"] : ["−3 + 3 = 0"]);
    expect(prompt.instruction).toContain("The factor equals zero at the root.");
    expect(prompt.instruction.startsWith("You chose the correct factor.")).toBe(choice === "plus");
    expect(prompt.title).toBe("Explain");
    expect(learningInputPolicy(revealed.lesson).enabled).toBe(false);
    expect(place(revealed, -2)).toBe(revealed);
    const entry = learningReducer(revealed, { type: "continue", revision: revealed.manipulation.revision });
    expect(entry.lesson).toEqual({ stage: "retrieval", prediction: choice, panel: "challenge", evidence: { checkAttempts: 0, incorrectChecks: 0, assistanceViewed: false }, feedback: null });
    expect(entry.manipulation.math.movingRoot).toBe(-3);
    const entryPresentation = guidedPresentation(entry.lesson, true, false, true);
    expect(entryPresentation.policy.maskMovingFactor).toBe(true);
    expect(entryPresentation.task?.factor).toBe("(x + 4)");
    expect(entryPresentation.prompt.actions).toEqual([]);
    expect(entryPresentation.prompt.navigation).toMatchObject({ id: "check", enabled: true });
    expect(place(entry, -4).lesson.stage).toBe("retrieval");
  });
}

test("discrete −3 placement reveals; stale events and inactive surfaces cannot advance", () => {
  const pending = ready(place(initialLearning(), 2));
  const wrongRevision = learningReducer(pending, { type: "predict", choice: "plus", revision: pending.manipulation.revision - 1 });
  expect(wrongRevision).toBe(pending);
  expect(learningReducer(pending, { type: "predict", choice: "plus", revision: pending.manipulation.revision }, false)).toBe(pending);
  const movement = predict(pending, "plus");
  const editing = rootEvent(movement, "start");
  const suspended = learningReducer(rootEvent(editing, "preview", -3), { type: "suspend" }, false);
  expect(suspended.lesson).toEqual(movement.lesson);
  expect(suspended.manipulation.edit).toBeNull();
  expect(suspended.manipulation.math.movingRoot).toBe(2);
  expect(learningReducer(suspended, { type: "root", action: { type: "commit", root: -3, revision: editing.manipulation.revision, sessionId: 1 } })).toBe(suspended);
  expect(place(suspended, -3).lesson.stage).toBe("reveal-explanation");
  expect(learningReducer(pending, { type: "continue", revision: pending.manipulation.revision })).toBe(pending);
});

test("prediction masking and neutral sizing contain no hidden factor/operator/substitution answers", () => {
  const pending = ready(place(initialLearning(), 4));
  const presentation = guidedPresentation(pending.lesson, true, false, true);
  const scene = rootsFactorsLayout(pending.manipulation.math, { width: 366, height: 400 }, presentation.policy);
  expect(scene.expression.factors[1].text).toBe("( ? )");
  expect(presentation.prompt.actions.map((action) => action.label)).toEqual(["(x − 3)", "(x + 3)"]);
  expect(presentation.prompt.actions.every((action) => action.enabled)).toBe(true);
  for (const sizing of promptSizingScenes) {
    const content = [sizing.title, sizing.instruction, sizing.target, sizing.feedback, sizing.navigation?.label ?? null, ...sizing.working, ...sizing.summary,
      ...sizing.comparison.flatMap((row) => [row.label, row.factor, row.substitution]), ...sizing.actions.map((action) => action.label)];
    expect(content.filter((text) => text !== null).every((text) => /^[0\s]*$/.test(text!))).toBe(true);
  }
});

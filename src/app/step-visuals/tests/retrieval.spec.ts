import { expect, test } from "@playwright/test";
import { initialLearning, learningReducer, learningInputPolicy, type LearningState } from "../activities/roots-factors/learning";
import { evaluateCard1, retrievalTarget } from "../activities/roots-factors/model";
import { evaluateFactor } from "../core/math/realFactors";
import { guidedPresentation, promptSizingScenes } from "../activities/roots-factors/presentationLayouts";
import { rootsFactorsLayout } from "../activities/roots-factors/rootsFactorsLayout";

type Control = "ready" | "continue" | "check" | "explanation" | "start-again";
const act = (state: LearningState, type: Control) => learningReducer(state, { type, revision: state.manipulation.revision });
const place = (state: LearningState, root: number) => learningReducer(state, { type: "root", action: { type: "place", revision: state.manipulation.revision, root } });
const start = (state: LearningState) => learningReducer(state, { type: "root", action: { type: "start", revision: state.manipulation.revision, sessionId: state.manipulation.lastSessionId + 1 } });
const edit = (state: LearningState, type: "preview" | "commit" | "cancel", root = -3) => learningReducer(state, { type: "root", action: { type, root, revision: state.manipulation.revision, sessionId: state.manipulation.lastSessionId } });
const retrieval = (): LearningState => {
  const prediction = act(place(initialLearning(), 4), "ready");
  const movement = learningReducer(prediction, { type: "predict", choice: "minus", revision: prediction.manipulation.revision });
  return act(place(movement, -3), "continue");
};
const evidence = (state: LearningState) => {
  if (!("evidence" in state.lesson)) throw new Error("Expected retrieval or completed lesson");
  return state.lesson.evidence;
};
const feedback = (state: LearningState) => {
  if (state.lesson.stage !== "retrieval") throw new Error("Expected retrieval lesson");
  return state.lesson.feedback;
};
const presentation = (state: LearningState, active = true) => guidedPresentation(state.lesson, state.manipulation.hasChangedPlacement, state.manipulation.edit !== null, active);

test("Try retains −3, offers Check immediately and has no pre-requested explanation", () => {
  const state = retrieval();
  expect(state.manipulation.math.movingRoot).toBe(-3);
  expect(state.lesson).toEqual({ stage: "retrieval", prediction: "minus", panel: "challenge", evidence: { checkAttempts: 0, incorrectChecks: 0, assistanceViewed: false }, feedback: null });
  expect(learningInputPolicy(state.lesson)).toEqual({ enabled: true, bounds: [-5, 5] });
  expect(presentation(state).prompt).toMatchObject({ title: "Try", target: null, working: [], actions: [], instruction: "Drag the green root to the correct position for (x + 4).", navigation: { id: "check", label: "Check", enabled: true, directionCue: false } });
  expect(presentation(state).task).toEqual({ label: "Factor:", factor: "(x + 4)", question: "Root = ?", accessibleDescription: "Factor: (x + 4). Root = ?" });
  expect(act(state, "explanation")).toBe(state);
  // Retrieval intentionally does not inherit orientation's placement eligibility gate.
  expect(evidence(act({ ...state, manipulation: { ...state.manipulation, hasChangedPlacement: false } }, "check")).incorrectChecks).toBe(1);
});

test("assessment uses the target linear factor; every plotted movable root zeros the quadratic", () => {
  for (let root = -5; root <= 5; root++) {
    const placed = place(retrieval(), root);
    expect(evaluateCard1(placed.manipulation.math, root)).toBe(0);
    expect(evaluateFactor(retrievalTarget, root) === 0).toBe(root === -4);
    const checked = act(placed, "check");
    expect(checked.lesson.stage).toBe(root === -4 ? "completed" : "retrieval");
    expect(evidence(checked)).toEqual({ checkAttempts: 1, incorrectChecks: root === -4 ? 0 : 1, assistanceViewed: false });
  }
});

test("continuous passing, cancellation and snapping never assess; active edits cannot Check", () => {
  const state = retrieval();
  const editing = edit(start(state), "preview", -4);
  expect(editing.manipulation.math.movingRoot).toBe(-3);
  expect(editing.lesson).toEqual(state.lesson);
  expect(act(editing, "check")).toBe(editing);
  expect(presentation(editing).prompt.navigation?.enabled).toBe(false);
  const cancelled = edit(editing, "cancel");
  expect(evidence(cancelled).checkAttempts).toBe(0);
  const snapped = edit(edit(start(cancelled), "preview", -3.6), "commit", -3.6);
  expect(snapped.manipulation.math.movingRoot).toBe(-4);
  expect(snapped.lesson.stage).toBe("retrieval");
  expect(evidence(snapped).checkAttempts).toBe(0);
  expect(act(snapped, "check").lesson.stage).toBe("completed");
});

test("wrong Checks count deliberate retries, reject duplicate revisions and do not imply assistance", () => {
  const state = retrieval();
  const action = { type: "check", revision: state.manipulation.revision } as const;
  const first = learningReducer(state, action);
  expect(feedback(first)).toEqual({ checkedRoot: -3, attempt: 1 });
  expect(presentation(first).prompt.actions).toMatchObject([{ id: "explanation", enabled: true }]);
  expect(learningReducer(first, action)).toBe(first);
  const second = act(first, "check");
  expect(evidence(second)).toEqual({ checkAttempts: 2, incorrectChecks: 2, assistanceViewed: false });
  expect(presentation(second).prompt.announcement?.id).not.toBe(presentation(first).prompt.announcement?.id);
  const success = act(place(second, -4), "check");
  expect(success.lesson).toMatchObject({ stage: "completed", successMode: "independent" });
  expect(evidence(success)).toEqual({ checkAttempts: 3, incorrectChecks: 2, assistanceViewed: false });
});

test("feedback clears only on a genuinely changed committed placement; help eligibility persists", () => {
  const wrong = act(retrieval(), "check");
  const transient = edit(start(wrong), "preview", -4.2);
  expect(feedback(transient)).toEqual(feedback(wrong));
  const cancelled = edit(transient, "cancel");
  expect(feedback(cancelled)).toEqual(feedback(wrong));
  const unchanged = edit(edit(start(cancelled), "preview", -4), "commit", -3.2);
  expect(feedback(unchanged)).toEqual(feedback(wrong));
  expect(feedback(place(unchanged, -3))).toEqual(feedback(wrong));
  const changed = edit(start(unchanged), "commit", -3.6);
  expect(feedback(changed)).toBeNull();
  expect(changed.lesson.stage).toBe("retrieval");
  expect(evidence(changed)).toEqual(evidence(wrong));
  expect(presentation(changed).prompt.actions).toMatchObject([{ id: "explanation", enabled: true }]);
  expect(feedback(place(wrong, -2))).toBeNull();
});

test("requested assistance preserves root, permits immediate editing and still requires an explicit correct Check", () => {
  const wrong = act(place(retrieval(), -2), "check");
  const explanation = act(wrong, "explanation");
  expect(explanation.manipulation.math.movingRoot).toBe(-2);
  expect(explanation.lesson).toMatchObject({ stage: "retrieval", panel: "explanation" });
  expect(evidence(explanation)).toEqual({ checkAttempts: 1, incorrectChecks: 1, assistanceViewed: true });
  expect(learningInputPolicy(explanation.lesson).enabled).toBe(true);
  expect(presentation(explanation).policy.maskMovingFactor).toBe(true);
  expect(presentation(explanation).prompt.working).toEqual(["(x + 4) = 0", "x = −4"]);
  expect(presentation(explanation).prompt.navigation).toMatchObject({ id: "check", enabled: true });
  const moving = edit(start(explanation), "preview", -3.7);
  expect(moving.lesson).toEqual(explanation.lesson);
  expect(presentation(moving).prompt.navigation?.enabled).toBe(false);
  expect(act(moving, "check")).toBe(moving);
  const cancelled = edit(moving, "cancel");
  expect(cancelled.manipulation.math.movingRoot).toBe(-2);
  expect(cancelled.lesson).toEqual(explanation.lesson);
  const anotherWrong = act(cancelled, "check");
  expect(anotherWrong.lesson).toMatchObject({ panel: "challenge" });
  expect(presentation(anotherWrong).prompt.working).toEqual([]);
  const reopened = act(anotherWrong, "explanation");
  const positioned = place(reopened, -4);
  expect(positioned.lesson).toMatchObject({ stage: "retrieval", panel: "explanation" });
  const success = act(positioned, "check");
  expect(success.lesson).toMatchObject({ stage: "completed", successMode: "assisted" });
  expect(evidence(success)).toEqual({ checkAttempts: 3, incorrectChecks: 2, assistanceViewed: true });
});

for (const assisted of [false, true]) test(`Finished locks −4 and Start again resets ${assisted ? "assisted" : "independent"} evidence safely`, () => {
  const challenge = assisted ? act(act(retrieval(), "check"), "explanation") : retrieval();
  const placed = edit(start(challenge), "commit", -4);
  const success = act(placed, "check");
  expect(learningInputPolicy(success.lesson).enabled).toBe(false);
  expect(place(success, 5)).toBe(success);
  expect(act(success, "check")).toBe(success);
  expect(success.lesson).toMatchObject({ successMode: assisted ? "assisted" : "independent" });
  expect(presentation(success).prompt).toMatchObject({ title: "Finished", navigation: { id: "start-again", label: "Start again", enabled: true }, summary: ["You found the correct root!", "The factor is (x + 4), so the root is x = −4."], working: ["−4 + 4 = 0"], instruction: "The factor equals zero at the root." });
  const fresh = act(success, "start-again");
  expect(fresh.lesson).toEqual({ stage: "orientation" });
  expect(fresh.manipulation.math.movingRoot).toBe(3);
  expect(fresh.manipulation.hasChangedPlacement).toBe(false);
  expect(fresh.manipulation.revision).toBeGreaterThan(success.manipulation.revision);
  expect(fresh.manipulation.lastSessionId).toBe(success.manipulation.lastSessionId);
  expect(learningInputPolicy(fresh.lesson)).toEqual({ enabled: true, bounds: [0, 5] });
  expect(presentation(fresh).prompt.navigation?.enabled).toBe(false);
  expect(learningReducer(fresh, { type: "root", action: { type: "start", revision: fresh.manipulation.revision, sessionId: placed.manipulation.lastSessionId } })).toBe(fresh);
  expect(learningReducer(fresh, { type: "check", revision: success.manipulation.revision })).toBe(fresh);
  const secondRetrieval = act(place(learningReducer(act(place(fresh, 4), "ready"), { type: "predict", choice: "plus", revision: fresh.manipulation.revision + 1 }), -3), "continue");
  expect(evidence(secondRetrieval)).toEqual({ checkAttempts: 0, incorrectChecks: 0, assistanceViewed: false });
});

test("inactive, stale, wrong-panel and wrong-stage controls cannot change evidence", () => {
  for (const type of ["check", "explanation", "start-again"] as const) expect(act(initialLearning(), type).lesson.stage).toBe("orientation");
  const wrong = act(retrieval(), "check");
  for (const type of ["check", "explanation", "start-again"] as const) {
    expect(learningReducer(wrong, { type, revision: wrong.manipulation.revision }, false)).toBe(wrong);
    expect(learningReducer(wrong, { type, revision: wrong.manipulation.revision - 1 })).toBe(wrong);
  }
  const editing = edit(start(wrong), "preview", -4);
  expect(act(editing, "explanation")).toBe(editing);
  const suspended = learningReducer(editing, { type: "suspend" }, false);
  expect(suspended.manipulation.math.movingRoot).toBe(-3);
  expect(suspended.lesson).toEqual(wrong.lesson);
  expect(suspended.manipulation.edit).toBeNull();
  expect(learningReducer(suspended, { type: "check", revision: editing.manipulation.revision })).toBe(suspended);
  expect(evidence(suspended)).toEqual(evidence(wrong));
});

test("presentation remains masked until requested help or success; sizing contains neutral text only", () => {
  for (const root of [-5, -4, -3, 1, 5]) {
    const state = place(retrieval(), root);
    const prepared = presentation(state);
    const scene = rootsFactorsLayout(state.manipulation.math, { width: 366, height: 428 }, prepared.policy);
    expect(scene.expression.factors[1].text).toBe("( ? )");
    expect(scene.expression.accessibleDescription).toContain("hidden factor");
    expect(prepared.prompt.working).toEqual([]);
    expect(prepared.prompt.instruction).not.toContain("−4");
    expect(presentation(state, false).prompt.navigation?.enabled).toBe(false);
  }
  for (const scene of promptSizingScenes) {
    expect(scene.announcement).toBeNull();
    const text = [scene.title, scene.instruction, scene.target, scene.feedback, ...scene.working, ...scene.summary, scene.navigation?.label,
      ...scene.actions.map((action) => action.label), ...scene.comparison.flatMap((row) => [row.label, row.factor, row.substitution])].filter((item) => item != null).join(" ");
    expect(text).toMatch(/^[0\s]*$/);
  }
  const independent = act(place(retrieval(), -4), "check");
  const assisted = act(place(act(act(retrieval(), "check"), "explanation"), -4), "check");
  expect(presentation(independent)).toEqual(presentation(assisted));
  expect(Object.isFrozen(evidence(assisted))).toBe(true);
});

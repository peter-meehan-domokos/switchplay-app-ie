import assert from "node:assert/strict";
import test from "node:test";
import { buildInteractiveVisualHostLayout } from "../src/components/interactiveVisuals/interactiveVisualHostLayout";
import { hostedRootsPresentation } from "../src/app/step-visuals/activities/roots-factors/presentationLayouts";

test("host attempt controls appear only at the permitted lifecycle stages", () => {
  const run = () => {};
  const base = { stageId: "stage", atStart: false, completed: false, backToStart: run, startNewAttempt: run };
  assert.equal(buildInteractiveVisualHostLayout("Visual", base, "Pending").backToStart, null);
  assert.equal(buildInteractiveVisualHostLayout("Visual", base, "Pending").startNewAttempt, null);
  assert.equal(buildInteractiveVisualHostLayout("Visual", { ...base, completed: true }, "Pending").backToStart, run);
  assert.equal(buildInteractiveVisualHostLayout("Visual", { ...base, atStart: true }, "Pending").startNewAttempt, run);
});

test("hosted Roots presentation removes only generic navigation and retains mathematical controls", () => {
  assert.equal(hostedRootsPresentation({ stage: "orientation" }, true, false, true).prompt.navigation, null);
  const prediction = hostedRootsPresentation({ stage: "prediction" }, true, false, true);
  assert.deepEqual(prediction.prompt.actions.map((action) => action.id), ["predict-minus", "predict-plus"]);
  const retrieval = hostedRootsPresentation({ stage: "retrieval", prediction: "plus", panel: "challenge",
    evidence: { checkAttempts: 1, incorrectChecks: 1, assistanceViewed: false }, feedback: null }, true, false, true);
  assert.equal(retrieval.prompt.navigation?.id, "check");
  assert.equal(retrieval.prompt.navigation?.enabled, true);
  assert.deepEqual(retrieval.prompt.actions.map((action) => action.id), ["explanation"]);
});

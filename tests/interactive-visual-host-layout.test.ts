import assert from "node:assert/strict";
import test from "node:test";
import { buildInteractiveVisualHostLayout, visualPersistenceNotice } from "../src/components/interactiveVisuals/interactiveVisualHostLayout";
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

test("routine persistence statuses are silent without discarding error or recovery feedback", () => {
  for (const status of ["", "Saved", "Development session only", "Changes pending", "Pending changes", "Pending", "Saving", "Saving…", "Saving...", "Syncing", "Synchronising", "Synchronizing…", "Previous attempt kept", "Previous attempt pending backup"]) {
    assert.equal(visualPersistenceNotice(status), null, status);
  }
  for (const status of ["Saving failed. Device storage is unavailable.", "Changes pending. Waiting to reconnect.", "Saving conflict. Your pending work is kept on this device.", "Saving stopped. Your pending work is kept on this device.", "Another tab changed this attempt. Reload before editing.", "Unable to start a new attempt. Your current work is kept.", "Unexpected persistence error"]) {
    assert.equal(visualPersistenceNotice(status), status);
  }
});

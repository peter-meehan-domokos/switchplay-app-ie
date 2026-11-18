import assert from "node:assert/strict";
import test from "node:test";
import { createRootsHostedState, reduceRootsHostedState, restoreRootsHostedState, rootsBackToStart, rootsHostNavigation, rootsSnapshot } from "../src/app/step-visuals/activities/roots-factors/hostState";
import { createIntegrationHostedState, integrationHostNavigation, integrationSnapshot, reduceIntegrationHostedState, restoreIntegrationHostedState } from "../src/app/step-visuals/activities/integration-area/hostState";

test("each visual declares contextual sign-in only after stage progress and restores that capability", () => {
  let roots = createRootsHostedState("roots-progress"); assert.equal(rootsHostNavigation(roots).hasMeaningfulProgress, false);
  roots = reduceRootsHostedState(roots, { type: "root", action: { type: "place", root: 4, revision: roots.recorded.learning.manipulation.revision } });
  assert.equal(rootsHostNavigation(roots).hasMeaningfulProgress, false);
  roots = reduceRootsHostedState(roots, { type: "ready", revision: roots.recorded.learning.manipulation.revision });
  assert.equal(rootsHostNavigation(restoreRootsHostedState(rootsSnapshot(roots))).hasMeaningfulProgress, true);
  assert.equal(rootsHostNavigation(rootsBackToStart(roots)).hasMeaningfulProgress, true);
  assert.equal(rootsHostNavigation(createRootsHostedState("new-attempt")).hasMeaningfulProgress, false);
  let integration = createIntegrationHostedState("integration-progress"); assert.equal(integrationHostNavigation(integration).hasMeaningfulProgress, false);
  integration = reduceIntegrationHostedState(integration, { type: "next", revision: integration.state.revision });
  assert.equal(integrationHostNavigation(integration).hasMeaningfulProgress, true);
  integration = reduceIntegrationHostedState(integration, { type: "previous", revision: integration.state.revision });
  assert.equal(integrationHostNavigation(restoreIntegrationHostedState(integrationSnapshot(integration))).hasMeaningfulProgress, true);
});

import { expect, test } from "@playwright/test";
import { effectiveMath, initialManipulation, manipulationReducer, type ManipulationState } from "../activities/roots-factors/manipulation";
import { createCard1Math, initialMath } from "../activities/roots-factors/model";
import type { RootInputPolicy } from "../core/interaction/rootInteraction";

const orientation: RootInputPolicy = { enabled: true, bounds: [0, 5] };
const full: RootInputPolicy = { enabled: true, bounds: [-5, 5] };
const begin = (state = initialManipulation(initialMath, "orientation")): ManipulationState => manipulationReducer(state, { type: "start", revision: state.revision, sessionId: 1 }, orientation);

test("live candidates stay separate from settled mathematics until final-position commit", () => {
  const initial = initialManipulation(initialMath, "orientation");
  const started = begin(initial);
  const preview = manipulationReducer(started, { type: "preview", revision: 0, sessionId: 1, root: 3.25 }, orientation);
  expect(preview.math.movingRoot).toBe(3);
  expect(effectiveMath(preview).movingRoot).toBe(3.25);
  expect(preview.hasChangedPlacement).toBe(false);
  const committed = manipulationReducer(preview, { type: "commit", revision: 0, sessionId: 1, root: 4.8 }, orientation);
  expect(committed.math.movingRoot).toBe(5);
  expect(committed.edit).toBeNull();
  expect(committed.hasChangedPlacement).toBe(true);
  expect(initial.math.movingRoot).toBe(3);
  expect(Object.isFrozen(preview.edit)).toBe(true);
});

test("cancellation restores the settled root and does not count as changed placement", () => {
  const preview = manipulationReducer(begin(), { type: "preview", revision: 0, sessionId: 1, root: 4.37 }, orientation);
  const cancelled = manipulationReducer(preview, { type: "cancel", revision: 0, sessionId: 1 }, { ...orientation, enabled: false });
  expect(effectiveMath(cancelled).movingRoot).toBe(3);
  expect(cancelled.hasChangedPlacement).toBe(false);
  expect(cancelled.edit).toBeNull();
});

test("unchanged commit does not unlock the future readiness predicate", () => {
  const committed = manipulationReducer(begin(), { type: "commit", revision: 0, sessionId: 1, root: 3.49 }, orientation);
  expect(committed.hasChangedPlacement).toBe(false);
});

test("discrete placement respects bounds, lock policy and transaction ownership", () => {
  const initial = initialManipulation(initialMath, "orientation");
  for (const root of [-1, 6, 2.5, Infinity, NaN]) expect(manipulationReducer(initial, { type: "place", revision: 0, root }, orientation)).toBe(initial);
  expect(manipulationReducer(initial, { type: "place", revision: 0, root: 2 }, { ...orientation, enabled: false })).toBe(initial);
  const started = begin(initial);
  expect(manipulationReducer(started, { type: "place", revision: 0, root: 2 }, orientation)).toBe(started);
  const placed = manipulationReducer(initial, { type: "place", revision: 0, root: 1 }, orientation);
  expect(placed.math.movingRoot).toBe(1);
  expect(placed.hasChangedPlacement).toBe(true);
});

test("stale pointer events and repeated commits cannot modify current state", () => {
  const started = begin();
  expect(manipulationReducer(started, { type: "preview", revision: 0, sessionId: 2, root: 5 }, orientation)).toBe(started);
  expect(manipulationReducer(started, { type: "cancel", revision: 0, sessionId: 2 }, orientation)).toBe(started);
  expect(manipulationReducer(started, { type: "preview", revision: 1, sessionId: 1, root: 5 }, orientation)).toBe(started);
  const committed = manipulationReducer(started, { type: "commit", revision: 0, sessionId: 1, root: 4 }, orientation);
  expect(manipulationReducer(committed, { type: "commit", revision: 0, sessionId: 1, root: 5 }, orientation)).toBe(committed);
  expect(manipulationReducer(committed, { type: "start", revision: 0, sessionId: 1 }, orientation)).toBe(committed);
});

test("context reset invalidates old transactions without creating a pedagogical transition", () => {
  const started = begin();
  const reset = manipulationReducer(started, { type: "reset", contextKey: "retrieval", math: createCard1Math(-3) }, full);
  expect(reset.revision).toBe(1);
  expect(reset.edit).toBeNull();
  expect(reset.math.movingRoot).toBe(-3);
  expect(reset.hasChangedPlacement).toBe(false);
  expect(manipulationReducer(reset, { type: "commit", revision: 0, sessionId: 1, root: 5 }, full)).toBe(reset);
  expect(manipulationReducer(reset, { type: "place", revision: 1, root: -4 }, full).math.movingRoot).toBe(-4);
  expect(Object.keys(reset)).not.toContain("lesson");
});

test("locked sessions and invalid candidate roots are rejected without corrupting the edit", () => {
  const started = begin();
  for (const root of [-3, 6, Infinity, NaN]) {
    expect(manipulationReducer(started, { type: "preview", revision: 0, sessionId: 1, root }, orientation)).toBe(started);
    expect(manipulationReducer(started, { type: "commit", revision: 0, sessionId: 1, root }, orientation)).toBe(started);
  }
  expect(manipulationReducer(started, { type: "commit", revision: 0, sessionId: 1, root: 4 }, { ...orientation, enabled: false })).toBe(started);
});

test("real drag candidates round only at commit, including negative half steps", () => {
  for (const [candidate, settled] of [[3.1, 3], [3.6, 4], [-3.49, -3], [-3.5, -4], [-4.99, -5], [0.49, 0]]) {
    const initial = initialManipulation(createCard1Math(3), "full");
    const started = manipulationReducer(initial, { type: "start", revision: 0, sessionId: 1 }, full);
    const preview = manipulationReducer(started, { type: "preview", revision: 0, sessionId: 1, root: candidate }, full);
    expect(effectiveMath(preview).movingRoot).toBe(candidate);
    expect(preview.math.movingRoot).toBe(3);
    const committed = manipulationReducer(preview, { type: "commit", revision: 0, sessionId: 1, root: candidate }, full);
    expect(committed.math.movingRoot).toBe(settled);
    expect(effectiveMath(committed).movingRoot).toBe(settled);
    expect(committed.edit).toBeNull();
  }
});

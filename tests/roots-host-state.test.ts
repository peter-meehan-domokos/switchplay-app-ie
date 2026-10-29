import assert from "node:assert/strict";
import test from "node:test";
import { acknowledgeRootsEvents, createRootsHostedState, isRootsSnapshot, reduceRootsHostedState, restoreRootsHostedState, rootsHostNavigation, rootsSnapshot, type RootsHostedState } from "../src/app/step-visuals/activities/roots-factors/hostState";
import type { LearningAction } from "../src/app/step-visuals/activities/roots-factors/learning";

const place = (state: RootsHostedState, root: number) => reduceRootsHostedState(state, { type: "root", action: { type: "place", revision: state.recorded.learning.manipulation.revision, root } });
const action = (state: RootsHostedState, type: "ready" | "continue" | "check" | "explanation") => reduceRootsHostedState(state, { type, revision: state.recorded.learning.manipulation.revision });
const predict = (state: RootsHostedState, choice: "minus" | "plus") => reduceRootsHostedState(state, { type: "predict", choice, revision: state.recorded.learning.manipulation.revision });
function journey() {
  const initial = createRootsHostedState("attempt-a"), orientation = place(initial, 4), prediction = action(orientation, "ready"), reveal = predict(prediction, "minus");
  const explanation = place(reveal, -3), retrieval = action(explanation, "continue"), checked = action(retrieval, "check"), assisted = action(checked, "explanation");
  const adjusted = place(assisted, -4), completed = action(adjusted, "check");
  return [initial, orientation, prediction, reveal, explanation, retrieval, checked, assisted, adjusted, completed];
}

test("every reachable stage including incorrect feedback restores exactly without emitting learning events", () => {
  for (const state of journey()) {
    const snapshot = rootsSnapshot(state);
    assert.equal(isRootsSnapshot(snapshot), true, state.recorded.learning.lesson.stage);
    const restored = restoreRootsHostedState(JSON.parse(JSON.stringify(snapshot)));
    assert.deepEqual(rootsSnapshot(restored), snapshot);
    assert.deepEqual(restored.recorded.records.events, []);
    assert.deepEqual(restored.recorded.records.completedAttempts, []);
    assert.equal(restored.recorded.records.exited, false);
    assert.equal(restored.recorded.learning.manipulation.edit, null);
  }
});

test("restored retrieval completes without missing prediction evidence or reused event IDs", () => {
  const state = journey()[7], previousSequence = state.sequence;
  const restored = restoreRootsHostedState(rootsSnapshot(state)), completed = action(place(restored, -4), "check");
  assert.equal(completed.recorded.learning.lesson.stage, "completed");
  assert.equal(completed.recorded.records.current.checkAttempts, 2);
  assert.equal(completed.recorded.records.current.incorrectChecks, 1);
  assert.equal(completed.recorded.records.current.successMode, "assisted");
  assert.ok(completed.recorded.records.events.every((event) => event.sequence > previousSequence));
  assert.equal(new Set(completed.recorded.records.events.map((event) => event.eventId)).size, completed.recorded.records.events.length);
  assert.ok(completed.recorded.records.events.every((event) => event.type !== "attempt-started"));
});

test("correct prediction and independent completion retain the same assessment after restoration", () => {
  const predicted = predict(action(place(createRootsHostedState("independent"), 5), "ready"), "plus");
  const tested = place(restoreRootsHostedState(rootsSnapshot(predicted)), -3);
  const retrieval = action(restoreRootsHostedState(rootsSnapshot(tested)), "continue");
  const complete = action(place(restoreRootsHostedState(rootsSnapshot(retrieval)), -4), "check");
  assert.equal(complete.recorded.records.current.prediction?.correct, true);
  assert.equal(complete.recorded.records.current.successMode, "independent");
  assert.equal(complete.recorded.records.current.checkAttempts, 1);
  assert.equal(isRootsSnapshot(rootsSnapshot(complete)), true);
});

test("corrupt cross-field state is rejected before the existing reducer can throw on completion", () => {
  const retrieval = rootsSnapshot(journey()[5]), completed = rootsSnapshot(journey()[9]);
  const invalid = [
    { ...retrieval, snapshotSchema: 2 }, { ...retrieval, attemptId: "" }, { ...retrieval, sequence: -1 },
    { ...retrieval, state: { ...retrieval.state, evidence: { ...retrieval.state.evidence, prediction: null } } },
    { ...retrieval, state: { ...retrieval.state, lesson: { ...retrieval.state.lesson, prediction: "other" } } },
    { ...retrieval, state: { ...retrieval.state, evidence: { ...retrieval.state.evidence, checkAttempts: 4 } } },
    { ...completed, state: { ...completed.state, root: 3 } },
    { ...retrieval, visited: { orientation: completed.state } },
  ];
  for (const snapshot of invalid) {
    assert.equal(isRootsSnapshot(snapshot), false);
    assert.throws(() => restoreRootsHostedState(snapshot), RangeError);
  }
});

test("snapshot excludes transient pointer candidate and history, and retains bounded stage work", () => {
  const state = journey()[1], revision = state.recorded.learning.manipulation.revision;
  const start = reduceRootsHostedState(state, { type: "root", action: { type: "start", revision, sessionId: 1 } });
  const preview = reduceRootsHostedState(start, { type: "root", action: { type: "preview", revision, sessionId: 1, root: 4.8 } });
  assert.deepEqual(rootsSnapshot(preview), rootsSnapshot(state));
  assert.deepEqual(preview.recorded.records.events, state.recorded.records.events);
  const completed = rootsSnapshot(journey()[9]);
  assert.equal(completed.visited.orientation?.root, 4);
  assert.ok(Object.keys(completed.visited).length <= 6);
  assert.equal(JSON.stringify(completed).includes('"events"'), false);
  assert.equal(JSON.stringify(completed).includes('"placements"'), false);
});

test("batched actions retain every pending event until acknowledged without resetting sequence", () => {
  const state = journey()[9], events = state.recorded.records.events;
  assert.equal(events.length, state.sequence);
  assert.equal(events[0].type, "attempt-started");
  assert.equal(events.at(-1)?.type, "attempt-completed");
  const acknowledged = acknowledgeRootsEvents(state, events[2].sequence);
  assert.deepEqual(acknowledged.recorded.records.events, events.slice(3));
  assert.deepEqual(rootsSnapshot(acknowledged), rootsSnapshot(state));
  assert.throws(() => acknowledgeRootsEvents(state, state.sequence + 1));
});

test("host Next is a visual-owned capability; mathematical actions and completion are never generic Next", () => {
  const states = journey();
  assert.equal(rootsHostNavigation(states[0]).next?.enabled, false);
  assert.equal(rootsHostNavigation(states[1]).next?.action, "ready");
  assert.equal(rootsHostNavigation(states[4]).next?.action, "continue");
  for (const index of [2, 3, 5, 9]) assert.equal(rootsHostNavigation(states[index]).next, null);
  const completed = states[9];
  assert.equal(reduceRootsHostedState(completed, { type: "start-again", revision: completed.recorded.learning.manipulation.revision }), completed);
  const invalid: LearningAction = { type: "check", revision: 9999 };
  assert.equal(reduceRootsHostedState(states[5], invalid), states[5]);
});

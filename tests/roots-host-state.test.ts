import assert from "node:assert/strict";
import test from "node:test";
import { acknowledgeRootsEvents, createRootsHostedState, isRootsSnapshot, reduceRootsHostedState, restoreRootsHostedState, rootsBackToStart, rootsHostNavigation, rootsSnapshot, type RootsHostedState } from "../src/app/step-visuals/activities/roots-factors/hostState";
import type { LearningAction } from "../src/app/step-visuals/activities/roots-factors/learning";
import { isHostedRootsEvent } from "../src/app/step-visuals/activities/roots-factors/eventValidation";

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
    for (const event of state.recorded.records.events) assert.ok(isHostedRootsEvent(event), `Event rejected: ${event.type}`);
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

test("Back to Start retains the same attempt, stage work and aggregate evidence through another completion", () => {
  const completed = journey()[9], before = rootsSnapshot(completed);
  let state = rootsBackToStart(completed);
  assert.equal(state.recorded.learning.lesson.stage, "orientation"); assert.equal(state.recorded.learning.manipulation.math.movingRoot, 4);
  assert.equal(state.recorded.records.current.attemptId, before.attemptId); assert.equal(state.recorded.records.current.checkAttempts, 2);
  assert.ok(state.visited.completed); assert.ok(state.visited.retrieval);
  assert.equal(state.sequence, before.sequence + 1); assert.equal(state.recorded.records.events.at(-1)?.type, "stage-changed");
  assert.ok(isRootsSnapshot(rootsSnapshot(state)));
  state = restoreRootsHostedState(rootsSnapshot(state));
  state = place(predict(action(state, "ready"), "minus"), -3); state = action(state, "continue");
  assert.equal(state.recorded.learning.lesson.stage, "retrieval"); assert.equal(state.recorded.learning.manipulation.math.movingRoot, -4);
  state = action(state, "check");
  assert.equal(state.recorded.learning.lesson.stage, "completed"); assert.equal(state.recorded.records.current.checkAttempts, 3);
  assert.equal(state.recorded.records.current.successMode, "assisted");
  assert.ok(isRootsSnapshot(rootsSnapshot(state)));
  assert.equal(state.recorded.records.events.filter(e => e.type === "attempt-started").length, 0);
  assert.equal(state.recorded.records.events.filter(e => e.type === "answer-checked").at(-1)?.check.checkNumber, 3);
});

test("changed prediction prerequisites invalidate current retrieval feedback but retain old history and assistance", () => {
  let state = rootsBackToStart(journey()[9]);
  state = place(state, 5); state = place(predict(action(state, "ready"), "plus"), -3); state = action(state, "continue");
  assert.equal(state.recorded.learning.manipulation.math.movingRoot, -3); // Old -4 placement belongs to different prerequisite work.
  assert.equal(state.recorded.learning.lesson.stage, "retrieval");
  if (state.recorded.learning.lesson.stage !== "retrieval") throw new Error("Expected retrieval");
  assert.equal(state.recorded.learning.lesson.feedback, null); assert.equal(state.recorded.learning.lesson.evidence.assistanceViewed, true);
  state = action(place(action(state, "check"), -4), "check");
  assert.equal(state.recorded.records.current.checkAttempts, 4); assert.equal(state.recorded.records.current.successMode, "assisted");
  assert.ok(isRootsSnapshot(rootsSnapshot(state)));
});

test("older snapshots remain readable and earlier-stage snapshots cannot lose later aggregate evidence", () => {
  const snapshot = rootsSnapshot(journey()[5]);
  const legacy = Object.fromEntries(Object.entries(snapshot).filter(([key]) => key !== "attemptEvidence"));
  assert.ok(isRootsSnapshot(legacy)); assert.equal(restoreRootsHostedState(legacy).sequence, snapshot.sequence);
  const returned = Object.fromEntries(Object.entries(rootsSnapshot(rootsBackToStart(journey()[9]))).filter(([key]) => key !== "attemptEvidence"));
  assert.equal(isRootsSnapshot(returned), false);
  assert.equal(rootsBackToStart(createRootsHostedState("fresh" )).recorded.learning.lesson.stage, "orientation");
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

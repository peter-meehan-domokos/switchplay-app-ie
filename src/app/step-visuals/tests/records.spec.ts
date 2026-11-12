import { expect, test } from "@playwright/test";
import { initialRecordedLearning, recordedLearningReducer, type RecordedLearningState } from "../activities/roots-factors/recordedLearning";
import type { LearningAction } from "../activities/roots-factors/learning";
import type { Card1LearningEvent, Card1LearningResult, Card1SessionRecords } from "../activities/roots-factors/learningRecords";
import { createAttemptId, createLearningDeliveryCursor, deliverLearningNotifications } from "../platform/web/learningNotifications";

const lesson = (state: RecordedLearningState, action: LearningAction, active = true) => recordedLearningReducer(state, { type: "lesson", action }, active);
const control = (state: RecordedLearningState, type: "ready" | "continue" | "check" | "explanation") => lesson(state, { type, revision: state.learning.manipulation.revision });
const place = (state: RecordedLearningState, root: number) => lesson(state, { type: "root", action: { type: "place", root, revision: state.learning.manipulation.revision } });
const drag = (state: RecordedLearningState, type: "start" | "preview" | "commit" | "cancel", root = 3) => lesson(state, { type: "root", action: { type, root, sessionId: 1, revision: state.learning.manipulation.revision } });
const enterTry = () => {
  let state = control(place(initialRecordedLearning("first"), 4), "ready");
  state = lesson(state, { type: "predict", choice: "minus", revision: state.learning.manipulation.revision });
  state = place(state, -3);
  return control(state, "continue");
};

test("only accepted changed placements and learning actions create mathematical events", () => {
  const initial = initialRecordedLearning("first");
  expect(initial.records.events.map((event) => event.type)).toEqual(["attempt-started"]);
  expect(control(initial, "ready")).toBe(initial);
  expect(place(initial, 3).records).toBe(initial.records);
  const started = drag(initial, "start");
  const candidate = drag(started, "preview", 4.4);
  expect(candidate.records).toBe(initial.records);
  expect(drag(candidate, "cancel").records).toBe(initial.records);
  expect(drag(candidate, "commit", 3.49).records).toBe(initial.records);
  const committed = drag(candidate, "commit", 3.6);
  expect(committed.records.current.placements).toEqual([{ stage: "orientation", fromRoot: 3, toRoot: 4, input: "pointer" }]);
  expect(committed.records.events.at(-1)?.type).toBe("root-placed");
  expect(place(initial, 5).records.current.placements[0].input).toBe("keyboard");
  expect(lesson(initial, { type: "root", action: { type: "place", root: 5, revision: 99 } })).toBe(initial);
  expect(lesson(initial, { type: "root", action: { type: "place", root: 5, revision: 0 } }, false)).toBe(initial);
});

test("prediction submission stays unassessed until the settled reveal; cancelled crossings have no record", () => {
  let state = control(place(initialRecordedLearning("first"), 4), "ready");
  state = lesson(state, { type: "predict", choice: "plus", revision: state.learning.manipulation.revision });
  const submission = state.records.events.find((event) => event.type === "prediction-submitted")!;
  expect(submission.type === "prediction-submitted" && submission.prediction).toEqual({ proposedRoot: -3, chosenFactorRoot: -3, rootAtSubmission: 4, correct: null });
  const crossing = drag(drag(state, "start"), "preview", -3);
  expect(crossing.records).toBe(state.records);
  expect(drag(crossing, "cancel").records).toBe(state.records);
  const revealed = drag(crossing, "commit", -3);
  expect(revealed.records.current.prediction?.correct).toBe(true);
  expect(submission.type === "prediction-submitted" && submission.prediction.correct).toBeNull();
  expect(revealed.records.events.slice(-3).map((event) => event.type)).toEqual(["root-placed", "prediction-tested", "stage-changed"]);
});

for (const assisted of [false, true]) test(`checks and ${assisted ? "assisted" : "independent"} completion retain immutable individual evidence`, () => {
  let state = control(enterTry(), "check");
  state = control(place(state, 0), "check");
  if (assisted) state = control(state, "explanation");
  const positioned = place(state, -4);
  expect(positioned.records.completedAttempts).toEqual([]);
  state = control(positioned, "check");
  const result = state.records.completedAttempts[0];
  expect(result).toMatchObject({ schemaVersion: 1, activityVersion: 1, activityId: "roots-and-factors", attemptId: "first", attemptNumber: 1,
    status: "completed", stage: "completed", finalRoot: -4, settledRoot: -4, checkAttempts: 3, incorrectChecks: 2,
    assistanceRequested: assisted, successMode: assisted ? "assisted" : "independent" });
  expect(result.checks).toEqual([
    { checkNumber: 1, root: -3, targetFactorConstant: 4, factorValue: 1, correct: false, assistanceRequested: false },
    { checkNumber: 2, root: 0, targetFactorConstant: 4, factorValue: 4, correct: false, assistanceRequested: false },
    { checkNumber: 3, root: -4, targetFactorConstant: 4, factorValue: 0, correct: true, assistanceRequested: assisted },
  ]);
  expect(result.prediction.correct).toBe(false);
  expect(Object.isFrozen(result.checks)).toBe(true);
  expect(Object.isFrozen(result.checks[0])).toBe(true);
  expect(Object.isFrozen(result.placements[0])).toBe(true);
  expect(Object.isFrozen(result.prediction)).toBe(true);
  expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  const restarted = recordedLearningReducer(state, { type: "restart", revision: state.learning.manipulation.revision, reason: "start-again", nextAttemptId: "second" });
  expect(restarted.records.completedAttempts[0]).toBe(result);
  expect(restarted.records.current).toMatchObject({ attemptId: "second", attemptNumber: 2, stage: "orientation", settledRoot: 3, checks: [], placements: [], prediction: null, assistanceRequested: false });
  expect(restarted.records.events.slice(-2).map((event) => event.type)).toEqual(["attempt-restarted", "attempt-started"]);
  expect(restarted.learning.manipulation.hasChangedPlacement).toBe(false);
  expect(restarted.learning.manipulation.revision).toBeGreaterThan(state.learning.manipulation.revision);
  expect(restarted.records.events.map((event) => event.sequence)).toEqual(restarted.records.events.map((_, index) => index + 1));
  expect(new Set(restarted.records.events.map((event) => event.eventId)).size).toBe(restarted.records.events.length);
});

test("partial restarts/exits preserve snapshots, cancel editing and reject stale or repeated actions", () => {
  const original = drag(drag(place(initialRecordedLearning("first"), 4), "start"), "preview", 4.7);
  const restarted = recordedLearningReducer(original, { type: "restart", revision: original.learning.manipulation.revision, reason: "restart-request", nextAttemptId: "second" });
  expect(restarted.records.partialAttempts[0]).toMatchObject({ attemptId: "first", settledRoot: 4, status: "restarted" });
  expect(restarted.learning.manipulation.edit).toBeNull();
  expect(recordedLearningReducer(restarted, { type: "restart", revision: original.learning.manipulation.revision, reason: "restart-request", nextAttemptId: "third" })).toBe(restarted);
  expect(() => recordedLearningReducer(restarted, { type: "restart", revision: restarted.learning.manipulation.revision, reason: "restart-request", nextAttemptId: "first" })).toThrow();
  const hidden = lesson(restarted, { type: "suspend" }, false);
  const exited = recordedLearningReducer(hidden, { type: "exit", revision: null }, false);
  expect(exited.records.current).toMatchObject({ status: "exited", settledRoot: 3 });
  expect(exited.records.exited).toBe(true);
  expect(exited.records.events.at(-1)?.type).toBe("attempt-exited");
  expect(recordedLearningReducer(exited, { type: "exit", revision: null })).toBe(exited);
  expect(place(exited, 4)).toBe(exited);
});

test("record delivery is ordered, once per completion, replay/reentrancy safe and precedes host exit", () => {
  let state = control(place(enterTry(), -4), "check");
  const first = state.records.completedAttempts[0];
  state = recordedLearningReducer(state, { type: "restart", revision: null, reason: "start-again", nextAttemptId: "second" });
  state = place(state, 4);
  state = recordedLearningReducer(state, { type: "exit", revision: null });
  const cursor = createLearningDeliveryCursor();
  const events: Card1LearningEvent[] = [];
  const completions: Card1LearningResult[] = [];
  const snapshots: Card1SessionRecords[] = [];
  const order: string[] = [];
  const callbacks = {
    onEvent: (event: Card1LearningEvent) => { events.push(event); order.push(event.type); deliverLearningNotifications(state.records, cursor, callbacks); },
    onComplete: (result: Card1LearningResult) => { completions.push(result); order.push("callback-complete"); },
    onRecordsChange: (records: Card1SessionRecords) => { snapshots.push(records); order.push("snapshot"); },
    onExit: () => order.push("exit"),
  };
  deliverLearningNotifications(state.records, cursor, callbacks);
  deliverLearningNotifications(state.records, cursor, callbacks);
  deliverLearningNotifications(state.records, cursor, { ...callbacks });
  expect(events).toEqual(state.records.events);
  expect(completions).toEqual([first]);
  expect(snapshots).toEqual([state.records]);
  expect(order.slice(-3)).toEqual(["attempt-exited", "snapshot", "exit"]);
});

test("continuous preview does not inspect, copy or freeze historical arrays", () => {
  const started = drag(initialRecordedLearning("first"), "start");
  const records = new Proxy(started.records, { get(target, key) {
    if (key === "events" || key === "completedAttempts" || key === "partialAttempts") throw new Error("Historical traversal during drag");
    return Reflect.get(target, key);
  } });
  const state = Object.freeze({ ...started, records });
  for (let index = 0; index < 200; index++) expect(drag(state, "preview", index / 40).records).toBe(records);
});

test("platform identities are unique, opaque and independent of application identity", () => {
  const ids = Array.from({ length: 100 }, createAttemptId);
  expect(new Set(ids).size).toBe(ids.length);
  expect(ids.every((id) => id.length >= 32)).toBe(true);
});

test("late snapshot subscribers can capture archived results without replaying completion notifications", () => {
  const state = control(place(enterTry(), -4), "check");
  const cursor = createLearningDeliveryCursor();
  deliverLearningNotifications(state.records, cursor, {});
  const snapshots: Card1SessionRecords[] = [];
  const completions: Card1LearningResult[] = [];
  deliverLearningNotifications(state.records, cursor, { onRecordsChange: (value) => snapshots.push(value), onComplete: (value) => completions.push(value) });
  expect(snapshots[0].completedAttempts).toEqual(state.records.completedAttempts);
  expect(completions).toEqual([]);
});

test("exiting a finished attempt preserves the completed result and emits no second completion", () => {
  const completed = control(place(enterTry(), -4), "check");
  const exited = recordedLearningReducer(completed, { type: "exit", revision: completed.learning.manipulation.revision });
  expect(exited.records.current).toBe(completed.records.current);
  expect(exited.records.completedAttempts).toBe(completed.records.completedAttempts);
  expect(exited.records.partialAttempts).toEqual([]);
  expect(exited.records.current.status).toBe("completed");
  expect(exited.records.exited).toBe(true);
  expect(exited.records.events.filter((event) => event.type === "attempt-completed")).toHaveLength(1);
  expect(recordedLearningReducer(exited, { type: "exit", revision: null })).toBe(exited);
});

test("a failing host completion callback cannot undo evidence or prevent later snapshot delivery", () => {
  const completed = control(place(enterTry(), -4), "check");
  const cursor = createLearningDeliveryCursor();
  let completeCalls = 0;
  let errors = 0;
  let snapshot: Card1SessionRecords | null = null;
  const originalError = console.error;
  console.error = () => { errors++; };
  try {
    const callbacks = { onComplete: () => { completeCalls++; throw new Error("Host storage failure"); }, onRecordsChange: (value: Card1SessionRecords) => { snapshot = value; } };
    deliverLearningNotifications(completed.records, cursor, callbacks);
    deliverLearningNotifications(completed.records, cursor, callbacks);
  } finally { console.error = originalError; }
  expect(completeCalls).toBe(1);
  expect(errors).toBe(1);
  expect(snapshot).toBe(completed.records);
  expect(completed.learning.lesson.stage).toBe("completed");
});

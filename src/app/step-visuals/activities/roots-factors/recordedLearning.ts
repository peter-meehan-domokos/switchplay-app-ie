import { evaluateFactor } from "../../core/math/realFactors";
import { immutable } from "../../core/immutable";
import { initialLearning, learningReducer, type LearningAction, type LearningState } from "./learning";
import { retrievalTarget } from "./model";
import type { Card1AttemptSnapshot, Card1CheckRecord, Card1LearningEvent, Card1LearningEventPayload, Card1LearningResult, Card1SessionRecords } from "./learningRecords";

export type RecordedLearningState = Readonly<{ learning: LearningState; records: Card1SessionRecords }>;
export type RecordedLearningAction =
  | Readonly<{ type: "lesson"; action: LearningAction }>
  | Readonly<{ type: "restart"; revision: number | null; nextAttemptId: string; reason: "start-again" | "restart-request" }>
  | Readonly<{ type: "exit"; revision: number | null }>;

const identity = { schemaVersion: 1, activityVersion: 1, activityId: "roots-and-factors" } as const;
const newAttempt = (attemptId: string, attemptNumber: number): Card1AttemptSnapshot => {
  if (!attemptId.trim()) throw new RangeError("An attempt requires a non-empty identity.");
  return immutable({ ...identity, attemptId, attemptNumber, status: "in-progress", stage: "orientation", settledRoot: 3,
    prediction: null, placements: [], checks: [], checkAttempts: 0, incorrectChecks: 0, assistanceRequested: false, successMode: null });
};

/** All children are already immutable. Never recursively visit historical records here. */
const stateWith = (learning: LearningState, records: Card1SessionRecords): RecordedLearningState => Object.freeze({ learning, records });
const appendEvents = (records: Card1SessionRecords, attempt: Card1AttemptSnapshot, payloads: readonly Card1LearningEventPayload[]): readonly Card1LearningEvent[] => {
  const additions = payloads.map((payload, index): Card1LearningEvent => Object.freeze({ ...identity,
    attemptId: attempt.attemptId, attemptNumber: attempt.attemptNumber,
    sequence: records.events.length + index + 1, eventId: `${attempt.attemptId}:${records.events.length + index + 1}`, ...payload }));
  return Object.freeze([...records.events, ...additions]);
};

export const initialRecordedLearning = (attemptId: string): RecordedLearningState => {
  const current = newAttempt(attemptId, 1);
  const empty: Card1SessionRecords = immutable({ schemaVersion: 1, exited: false, current, completedAttempts: [], partialAttempts: [], events: [] });
  return stateWith(initialLearning(), Object.freeze({ ...empty, events: appendEvents(empty, current, [{ type: "attempt-started", root: 3 }]) }));
};

export const recordedLearningReducer = (state: RecordedLearningState, action: RecordedLearningAction, active = true): RecordedLearningState => {
  const { learning, records } = state;
  if (records.exited) return state;
  if (action.type === "exit") {
    if (action.revision !== null && action.revision !== learning.manipulation.revision) return state;
    const snapshot: Card1AttemptSnapshot = records.current.status === "completed" ? records.current : Object.freeze({ ...records.current, status: "exited" });
    return stateWith(learningReducer(learning, { type: "suspend" }), Object.freeze({ ...records, exited: true, current: snapshot,
      partialAttempts: snapshot.status === "exited" ? Object.freeze([...records.partialAttempts, snapshot]) : records.partialAttempts,
      events: appendEvents(records, snapshot, [{ type: "attempt-exited", snapshot }]) }));
  }
  if (action.type === "restart") {
    if ((action.revision !== null && (!active || action.revision !== learning.manipulation.revision)) || (action.reason === "start-again" && learning.lesson.stage !== "completed")) return state;
    if (!action.nextAttemptId.trim() || records.events.some((event) => event.attemptId === action.nextAttemptId)) throw new RangeError("Restart requires a fresh attempt identity.");
    const fresh = initialLearning();
    const reset = immutable({ ...fresh, manipulation: { ...fresh.manipulation, revision: learning.manipulation.revision + 1, lastSessionId: learning.manipulation.lastSessionId } });
    const current = newAttempt(action.nextAttemptId, records.current.attemptNumber + 1);
    const previous: Card1AttemptSnapshot = records.current.status === "in-progress" ? Object.freeze({ ...records.current, status: "restarted" }) : records.current;
    const ended = Object.freeze({ ...records,
      partialAttempts: previous.status === "restarted" ? Object.freeze([...records.partialAttempts, previous]) : records.partialAttempts,
      events: appendEvents(records, previous, [{ type: "attempt-restarted", reason: action.reason, previous, nextAttemptId: current.attemptId }]) });
    return stateWith(reset, Object.freeze({ ...ended, current, events: appendEvents(ended, current, [{ type: "attempt-started", root: 3 }]) }));
  }
  // Restart identity is allocated by the platform adapter, never inside a reducer.
  if (action.action.type === "start-again") return state;
  const next = learningReducer(learning, action.action, active);
  if (next === learning) return state;
  const input = action.action;
  // The high-frequency path performs no record traversal, cloning or event preparation.
  if (input.type === "suspend" || (input.type === "root" && input.action.type !== "commit" && input.action.type !== "place")) return stateWith(next, records);
  const payloads: Card1LearningEventPayload[] = [];
  let current = records.current;
  if (input.type === "root" && next.manipulation.math.movingRoot !== learning.manipulation.math.movingRoot) {
    const placement = immutable({ stage: learning.lesson.stage, fromRoot: learning.manipulation.math.movingRoot,
      toRoot: next.manipulation.math.movingRoot, input: input.action.type === "commit" ? "pointer" as const : "keyboard" as const });
    current = Object.freeze({ ...current, placements: Object.freeze([...current.placements, placement]) });
    payloads.push({ type: "root-placed", placement });
  }
  if (input.type === "predict" && next.lesson.stage === "reveal-position") {
    const prediction = immutable({ proposedRoot: -3 as const, chosenFactorRoot: input.choice === "minus" ? 3 as const : -3 as const,
      rootAtSubmission: next.manipulation.math.movingRoot, correct: null });
    current = Object.freeze({ ...current, prediction });
    payloads.push({ type: "prediction-submitted", prediction });
  }
  if (learning.lesson.stage === "reveal-position" && next.lesson.stage === "reveal-explanation" && current.prediction) {
    const prediction = Object.freeze({ ...current.prediction, correct: current.prediction.chosenFactorRoot === -3 });
    current = Object.freeze({ ...current, prediction });
    payloads.push({ type: "prediction-tested", prediction });
  }
  if (input.type === "check" && learning.lesson.stage === "retrieval") {
    const factorValue = evaluateFactor(retrievalTarget, next.manipulation.math.movingRoot);
    const check: Card1CheckRecord = immutable({ checkNumber: current.checkAttempts + 1, root: next.manipulation.math.movingRoot,
      targetFactorConstant: 4, factorValue, correct: factorValue === 0, assistanceRequested: current.assistanceRequested });
    current = Object.freeze({ ...current, checks: Object.freeze([...current.checks, check]), checkAttempts: check.checkNumber,
      incorrectChecks: current.incorrectChecks + (check.correct ? 0 : 1) });
    payloads.push({ type: "answer-checked", check });
  }
  if (input.type === "explanation") {
    current = Object.freeze({ ...current, assistanceRequested: true });
    payloads.push({ type: "assistance-requested", root: next.manipulation.math.movingRoot });
  }
  if (next.lesson.stage !== learning.lesson.stage) payloads.push({ type: "stage-changed", from: learning.lesson.stage, to: next.lesson.stage });
  if (!payloads.length) return stateWith(next, records);
  current = Object.freeze({ ...current, stage: next.lesson.stage, settledRoot: next.manipulation.math.movingRoot });
  let completed = records.completedAttempts;
  if (next.lesson.stage === "completed") {
    if (!current.prediction || current.prediction.correct === null || current.settledRoot !== -4) throw new Error("Incomplete completion evidence.");
    const result: Card1LearningResult = Object.freeze({ ...current, status: "completed", stage: "completed", settledRoot: -4, finalRoot: -4,
      prediction: Object.freeze({ ...current.prediction, correct: current.prediction.correct }), successMode: next.lesson.successMode });
    current = result;
    completed = Object.freeze([...completed, result]);
    payloads.push({ type: "attempt-completed", result });
  }
  // Freeze newly owned envelopes; older immutable arrays/entries are shared unchanged.
  const frozenPayloads = payloads.map((payload) => Object.freeze(payload));
  return stateWith(next, Object.freeze({ ...records, current, completedAttempts: completed,
    events: appendEvents(records, current, frozenPayloads) }));
};

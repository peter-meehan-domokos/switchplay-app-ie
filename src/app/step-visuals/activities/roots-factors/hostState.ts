import { immutable } from "../../core/immutable";
import { initialManipulation } from "./manipulation";
import { createCard1Math, type RootInteger } from "./model";
import type { LearningAction, Lesson } from "./learning";
import { initialRecordedLearning, recordedLearningReducer, type RecordedLearningState } from "./recordedLearning";
import type { Card1AttemptSnapshot, Card1LearningEvent, Card1LearningStage, Card1PredictionRecord } from "./learningRecords";

type Evidence = Readonly<{
  prediction: Card1PredictionRecord | null;
  checkAttempts: number; incorrectChecks: number; assistanceRequested: boolean;
}>;
export type RootsStageSnapshot = Readonly<{
  root: RootInteger; hasChangedPlacement: boolean; lesson: Lesson; evidence: Evidence;
}>;
export type RootsSnapshot = Readonly<{
  snapshotSchema: 1; activityId: "roots-and-factors"; activityVersion: 1;
  attemptId: string; attemptNumber: number; sequence: number;
  state: RootsStageSnapshot;
  visited: Readonly<Partial<Record<Card1LearningStage, RootsStageSnapshot>>>;
  /** Aggregate evidence survives visiting an earlier stage. Optional for pre-host snapshots. */
  attemptEvidence?: Evidence;
}>;
export type RootsHostedState = Readonly<{
  recorded: RecordedLearningState;
  sequence: number;
  visited: RootsSnapshot["visited"];
}>;

const stages = ["orientation", "prediction", "reveal-position", "reveal-explanation", "retrieval", "completed"] as const;
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const fields = (value: Record<string, unknown>, names: readonly string[], optional: readonly string[] = []) =>
  Object.keys(value).every(name => names.includes(name) || optional.includes(name)) && names.every(name => Object.hasOwn(value, name));
const count = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) < Number.MAX_SAFE_INTEGER - 100;
const root = (value: unknown): value is RootInteger => Number.isInteger(value) && Number(value) >= -5 && Number(value) <= 5;
const prediction = (value: unknown): value is Card1PredictionRecord => object(value)
  && fields(value, ["proposedRoot", "chosenFactorRoot", "rootAtSubmission", "correct"])
  && value.proposedRoot === -3 && (value.chosenFactorRoot === 3 || value.chosenFactorRoot === -3)
  && root(value.rootAtSubmission) && value.rootAtSubmission >= 0
  && (value.correct === null || typeof value.correct === "boolean");
const evidence = (value: unknown): value is Evidence => object(value)
  && fields(value, ["prediction", "checkAttempts", "incorrectChecks", "assistanceRequested"])
  && (value.prediction === null || prediction(value.prediction))
  && count(value.checkAttempts) && count(value.incorrectChecks) && value.incorrectChecks <= value.checkAttempts
  && typeof value.assistanceRequested === "boolean";

function validStage(value: unknown): value is RootsStageSnapshot {
  if (!object(value) || !fields(value, ["root", "hasChangedPlacement", "lesson", "evidence"])
    || !root(value.root) || typeof value.hasChangedPlacement !== "boolean" || !object(value.lesson) || !evidence(value.evidence)) return false;
  const lesson = value.lesson, progress = value.evidence, selected = progress.prediction;
  if (lesson.stage === "orientation" || lesson.stage === "prediction") {
    return fields(lesson, ["stage"]) && value.root >= 0 && selected === null && progress.checkAttempts === 0
      && !progress.assistanceRequested && (lesson.stage !== "prediction" || value.hasChangedPlacement);
  }
  if (!selected || !["minus", "plus"].includes(String(lesson.prediction))
    || selected.chosenFactorRoot !== (lesson.prediction === "minus" ? 3 : -3) || !value.hasChangedPlacement) return false;
  if (lesson.stage === "reveal-position" || lesson.stage === "reveal-explanation") {
    return fields(lesson, ["stage", "prediction"]) && progress.checkAttempts === 0 && !progress.assistanceRequested
      && (lesson.stage === "reveal-position" ? selected.correct === null : typeof selected.correct === "boolean" && value.root === -3);
  }
  if (typeof selected.correct !== "boolean" || !object(lesson.evidence)
    || !fields(lesson.evidence, ["checkAttempts", "incorrectChecks", "assistanceViewed"])
    || lesson.evidence.checkAttempts !== progress.checkAttempts || lesson.evidence.incorrectChecks !== progress.incorrectChecks
    || lesson.evidence.assistanceViewed !== progress.assistanceRequested) return false;
  if (lesson.stage === "completed") {
    return fields(lesson, ["stage", "prediction", "evidence", "successMode"]) && value.root === -4
      && progress.checkAttempts >= 1 && progress.incorrectChecks === progress.checkAttempts - 1
      && lesson.successMode === (progress.assistanceRequested ? "assisted" : "independent");
  }
  if (lesson.stage !== "retrieval" || !fields(lesson, ["stage", "prediction", "panel", "evidence", "feedback"])
    || !["challenge", "explanation"].includes(String(lesson.panel)) || progress.checkAttempts !== progress.incorrectChecks
    || (lesson.panel === "explanation" && !progress.assistanceRequested)) return false;
  return lesson.feedback === null || object(lesson.feedback) && fields(lesson.feedback, ["checkedRoot", "attempt"])
    && lesson.feedback.checkedRoot === value.root && value.root !== -4
    && lesson.feedback.attempt === progress.checkAttempts && progress.checkAttempts > 0;
}

/** Validate safe reducer invariants; historical assessment outcomes remain learner-reported. */
export function isRootsSnapshot(value: unknown): value is RootsSnapshot {
  if (!(object(value) && fields(value, ["snapshotSchema", "activityId", "activityVersion", "attemptId", "attemptNumber", "sequence", "state", "visited"], ["attemptEvidence"])
    && value.snapshotSchema === 1 && value.activityId === "roots-and-factors" && value.activityVersion === 1
    && typeof value.attemptId === "string" && value.attemptId.trim().length > 0 && value.attemptId.length <= 200
    && count(value.attemptNumber) && value.attemptNumber >= 1 && count(value.sequence) && validStage(value.state)
    && object(value.visited) && Object.hasOwn(value.visited, "orientation") && Object.entries(value.visited).every(([stage, saved]) => stages.includes(stage as Card1LearningStage)
      && validStage(saved) && saved.lesson.stage === stage))) return false;
  const aggregate = value.attemptEvidence === undefined ? value.state.evidence : value.attemptEvidence;
  return evidence(aggregate) && [value.state, ...Object.values(value.visited)].every(saved => validStage(saved)
    && aggregate.checkAttempts >= saved.evidence.checkAttempts && aggregate.incorrectChecks >= saved.evidence.incorrectChecks
    && (!saved.evidence.assistanceRequested || aggregate.assistanceRequested));
}

function stageSnapshot(state: RecordedLearningState): RootsStageSnapshot {
  const lesson = state.learning.lesson, current = state.records.current;
  const progress = "evidence" in lesson ? lesson.evidence : null;
  return immutable({ root: state.learning.manipulation.math.movingRoot,
    hasChangedPlacement: state.learning.manipulation.hasChangedPlacement, lesson,
    evidence: { prediction: "prediction" in lesson ? current.prediction : null,
      checkAttempts: progress?.checkAttempts ?? 0, incorrectChecks: progress?.incorrectChecks ?? 0, assistanceRequested: progress?.assistanceViewed ?? false } });
}

export function rootsSnapshot(state: RootsHostedState): RootsSnapshot {
  const current = state.recorded.records.current;
  return immutable({ snapshotSchema: 1, activityId: "roots-and-factors", activityVersion: 1,
    attemptId: current.attemptId, attemptNumber: current.attemptNumber, sequence: state.sequence,
    state: stageSnapshot(state.recorded), visited: state.visited,
    attemptEvidence: { prediction: current.prediction, checkAttempts: current.checkAttempts, incorrectChecks: current.incorrectChecks, assistanceRequested: current.assistanceRequested } });
}

export function createRootsHostedState(attemptId: string, attemptNumber = 1): RootsHostedState {
  const recorded = initialRecordedLearning(attemptId, attemptNumber);
  return immutable({ recorded, sequence: 1, visited: { orientation: stageSnapshot(recorded) } });
}

/** Hydration is deliberately separate from initialRecordedLearning: no new attempt/event/completion. */
export function restoreRootsHostedState(value: unknown): RootsHostedState {
  if (!isRootsSnapshot(value)) throw new RangeError("Invalid Roots and Factors snapshot.");
  const snapshot = structuredClone(value), saved = snapshot.state;
  const aggregate = snapshot.attemptEvidence ?? saved.evidence;
  const manipulation = { ...initialManipulation(createCard1Math(saved.root), "guided"), hasChangedPlacement: saved.hasChangedPlacement };
  const current: Card1AttemptSnapshot = { schemaVersion: 1, activityVersion: 1, activityId: "roots-and-factors",
    attemptId: snapshot.attemptId, attemptNumber: snapshot.attemptNumber, stage: saved.lesson.stage,
    status: saved.lesson.stage === "completed" ? "completed" : "in-progress", settledRoot: saved.root,
    ...aggregate, prediction: "prediction" in saved.lesson ? saved.evidence.prediction : aggregate.prediction,
    successMode: saved.lesson.stage === "completed" ? saved.lesson.successMode : null,
    placements: [], checks: [] };
  return immutable({ sequence: snapshot.sequence, visited: snapshot.visited,
    recorded: { learning: { manipulation, lesson: saved.lesson }, records: { schemaVersion: 1, exited: false,
      current, events: [], completedAttempts: [], partialAttempts: [] } } });
}

/** Pending events survive batched actions until the host acknowledges its durable local queue.
 * Historical arrays are not replayed into the reducer. The persistence adapter owns history.
 * Input/assessment semantics still run through the original visual reducer.
 */
export function reduceRootsHostedState(state: RootsHostedState, action: LearningAction, active = true): RootsHostedState {
  if (action.type === "start-again") return state; // Host owns explicit attempt allocation.
  const { lesson, manipulation } = state.recorded.learning;
  const retained = state.visited.retrieval, selected = state.recorded.records.current.prediction;
  if (action.type === "continue" && active && action.revision === manipulation.revision && !manipulation.edit && lesson.stage === "reveal-explanation"
    && retained && retained.lesson.stage === "retrieval" && retained.lesson.prediction === lesson.prediction
    && selected?.chosenFactorRoot === retained.evidence.prediction?.chosenFactorRoot && selected?.rootAtSubmission === retained.evidence.prediction?.rootAtSubmission) {
    return visitRootsStage(state, retained);
  }
  const input: RecordedLearningState = { learning: state.recorded.learning, records: { ...state.recorded.records,
    current: { ...state.recorded.records.current, placements: [], checks: [] }, events: [], completedAttempts: [], partialAttempts: [] } };
  let next = recordedLearningReducer(input, { type: "lesson", action }, active);
  if (next.learning === state.recorded.learning && next.records === input.records) return state;
  // Assistance belongs to the attempt, even if a changed earlier answer starts a new retrieval pass.
  if (next.learning.lesson.stage === "retrieval" && next.records.current.assistanceRequested && !next.learning.lesson.evidence.assistanceViewed) {
    next = { ...next, learning: { ...next.learning, lesson: { ...next.learning.lesson, evidence: { ...next.learning.lesson.evidence, assistanceViewed: true } } } };
  }
  const events = next.records.events.map((event, index) => ({ ...event, sequence: state.sequence + index + 1,
    eventId: `${event.attemptId}:${state.sequence + index + 1}` }));
  const recorded = { learning: next.learning, records: { ...next.records, events: [...state.recorded.records.events, ...events] } };
  const meaningful = events.length > 0;
  return immutable({ recorded, sequence: state.sequence + events.length,
    visited: meaningful ? { ...state.visited, [state.recorded.learning.lesson.stage]: stageSnapshot(state.recorded),
      [next.learning.lesson.stage]: stageSnapshot(recorded) } : state.visited });
}

function visitRootsStage(state: RootsHostedState, destination: RootsStageSnapshot): RootsHostedState {
  const previous = state.recorded, old = previous.learning.manipulation;
  let saved = destination;
  if (saved.lesson.stage === "retrieval" && previous.records.current.assistanceRequested) {
    saved = { ...saved, evidence: { ...saved.evidence, assistanceRequested: true }, lesson: { ...saved.lesson, evidence: { ...saved.lesson.evidence, assistanceViewed: true } } };
  }
  const snapshot = rootsSnapshot(state);
  const restored = restoreRootsHostedState({ ...snapshot, state: saved,
    visited: { ...snapshot.visited, [previous.learning.lesson.stage]: stageSnapshot(previous), [saved.lesson.stage]: saved } });
  const sequence = state.sequence + 1, current = restored.recorded.records.current;
  const event: Card1LearningEvent = { schemaVersion: 1, activityVersion: 1, activityId: "roots-and-factors", attemptId: current.attemptId,
    attemptNumber: current.attemptNumber, eventId: `${current.attemptId}:${sequence}`, sequence, type: "stage-changed", from: previous.learning.lesson.stage, to: saved.lesson.stage };
  return immutable({ ...restored, sequence, recorded: { learning: { ...restored.recorded.learning,
    manipulation: { ...restored.recorded.learning.manipulation, revision: old.revision + 1, lastSessionId: old.lastSessionId } },
    records: { ...restored.recorded.records, events: [...previous.records.events, event] } } });
}
export function rootsBackToStart(state: RootsHostedState): RootsHostedState {
  return state.recorded.learning.lesson.stage === "completed" && state.visited.orientation ? visitRootsStage(state, state.visited.orientation) : state;
}

/** Call only after the host has durably queued these events; network acknowledgements are separate. */
export function acknowledgeRootsEvents(state: RootsHostedState, throughSequence: number): RootsHostedState {
  if (!count(throughSequence) || throughSequence > state.sequence) throw new RangeError("Invalid event acknowledgement.");
  return immutable({ ...state, recorded: { ...state.recorded, records: { ...state.recorded.records,
    events: state.recorded.records.events.filter((event) => event.sequence > throughSequence) } } });
}

export function rootsHostNavigation(state: RootsHostedState) {
  const { lesson, manipulation } = state.recorded.learning;
  return { stageId: lesson.stage, atStart: lesson.stage === "orientation", completed: lesson.stage === "completed",
    hasMeaningfulProgress: Object.keys(state.visited).some(stage => stage !== "orientation"),
    previous: false,
    next: lesson.stage === "orientation" ? { enabled: manipulation.hasChangedPlacement && !manipulation.edit, action: "ready" as const }
      : lesson.stage === "reveal-explanation" ? { enabled: !manipulation.edit, action: "continue" as const } : null };
}

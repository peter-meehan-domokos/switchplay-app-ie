import type { Lesson, SuccessMode } from "./learning";
import type { RootInteger } from "./model";

export type Card1LearningStage = Lesson["stage"];
export type Card1RootPlacement = Readonly<{
  stage: Card1LearningStage; fromRoot: RootInteger; toRoot: RootInteger; input: "pointer" | "keyboard";
}>;
export type Card1PredictionRecord = Readonly<{
  proposedRoot: -3; chosenFactorRoot: 3 | -3; rootAtSubmission: RootInteger;
  /** Deliberately unavailable until the student has tested the prediction. */
  correct: boolean | null;
}>;
export type Card1CheckRecord = Readonly<{
  checkNumber: number; root: RootInteger; targetFactorConstant: 4; factorValue: number;
  correct: boolean; assistanceRequested: boolean;
}>;
export type Card1AttemptSnapshot = Readonly<{
  schemaVersion: 1; activityVersion: 1; activityId: "roots-and-factors";
  attemptId: string; attemptNumber: number;
  status: "in-progress" | "completed" | "restarted" | "exited";
  stage: Card1LearningStage; settledRoot: RootInteger;
  prediction: Card1PredictionRecord | null;
  placements: readonly Card1RootPlacement[]; checks: readonly Card1CheckRecord[];
  checkAttempts: number; incorrectChecks: number; assistanceRequested: boolean;
  successMode: SuccessMode | null;
}>;
export type Card1LearningResult = Card1AttemptSnapshot & Readonly<{
  status: "completed"; stage: "completed"; settledRoot: -4; finalRoot: -4;
  prediction: Card1PredictionRecord & Readonly<{ correct: boolean }>; successMode: SuccessMode;
}>;
type EventIdentity = Readonly<{
  schemaVersion: 1; activityVersion: 1; activityId: "roots-and-factors";
  attemptId: string; attemptNumber: number; eventId: string;
  /** Strictly increasing throughout this mounted session, including restarts. */
  sequence: number;
}>;
export type Card1LearningEventPayload =
  | Readonly<{ type: "attempt-started"; root: 3 }>
  | Readonly<{ type: "root-placed"; placement: Card1RootPlacement }>
  | Readonly<{ type: "prediction-submitted"; prediction: Card1PredictionRecord & Readonly<{ correct: null }> }>
  | Readonly<{ type: "prediction-tested"; prediction: Card1PredictionRecord & Readonly<{ correct: boolean }> }>
  | Readonly<{ type: "stage-changed"; from: Card1LearningStage; to: Card1LearningStage }>
  | Readonly<{ type: "answer-checked"; check: Card1CheckRecord }>
  | Readonly<{ type: "assistance-requested"; root: RootInteger }>
  | Readonly<{ type: "attempt-completed"; result: Card1LearningResult }>
  | Readonly<{ type: "attempt-restarted"; reason: "start-again" | "restart-request"; previous: Card1AttemptSnapshot; nextAttemptId: string }>
  | Readonly<{ type: "attempt-exited"; snapshot: Card1AttemptSnapshot }>;
export type Card1LearningEvent = EventIdentity & Card1LearningEventPayload;
export type Card1SessionRecords = Readonly<{
  schemaVersion: 1;
  exited: boolean;
  current: Card1AttemptSnapshot;
  completedAttempts: readonly Card1LearningResult[];
  partialAttempts: readonly Card1AttemptSnapshot[];
  events: readonly Card1LearningEvent[];
}>;
export type Card1LearningCallbacks = Readonly<{
  onComplete?: (result: Card1LearningResult) => void;
  onEvent?: (event: Card1LearningEvent) => void;
  /** Initial snapshot and meaningful updates only; never transient drag positions. */
  onRecordsChange?: (records: Card1SessionRecords) => void;
}>;

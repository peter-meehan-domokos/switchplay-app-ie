import type { IntegrationFunction } from "./model";

/** Six-stage v1 payloads remain identifiable; they are never relabelled as seven-stage evidence. */
type Stage = 1 | 2 | 3 | 4 | 5 | 6;
type Region = Readonly<{ top: Exclude<IntegrationFunction, "square">; bottom: Exclude<IntegrationFunction, "square">; a: number; b: number }>;
type Prediction = Readonly<{ function: "flat" | "rising"; multiplier: number; observed: boolean; correct: boolean | null }>;
type Calculation = Readonly<{ number: number; region: Region; submitted: number; expected: number; correct: boolean; assisted: boolean }>;
export type LegacyIntegrationAttempt = Readonly<{
  schemaVersion: 1; activityVersion: 1; activityId: "integration-area";
  attemptId: string; attemptNumber: number; stage: Stage;
  status: "in-progress" | "completed" | "restarted" | "exited";
  region: Region; predictions: readonly Prediction[]; checks: readonly Calculation[];
  assistanceRequested: boolean; successMode: "independent" | "assisted" | null;
}>;
export type LegacyIntegrationResult = LegacyIntegrationAttempt & Readonly<{
  status: "completed"; area: number; outcome?: "correct" | "incorrect"; finalCalculation?: Calculation;
}>;
type Detail =
  | Readonly<{ type: "attempt-started" }>
  | Readonly<{ type: "boundary-committed"; boundary: "a" | "b"; from: number; to: number; input: "pointer" | "keyboard" | "value" }>
  | Readonly<{ type: "function-selected"; function: "flat" | "rising" }>
  | Readonly<{ type: "comparison-demonstrated"; function: "flat" | "rising"; from: 2; to: 4 }>
  | Readonly<{ type: "refinement-changed"; rectangles: number }>
  | Readonly<{ type: "prediction-submitted" | "prediction-tested"; prediction: Prediction }>
  | Readonly<{ type: "region-selected"; region: Region; selection?: readonly [IntegrationFunction, IntegrationFunction] }>
  | Readonly<{ type: "interval-selected"; region: Region }>
  | Readonly<{ type: "stage-changed"; from: Stage; to: Stage; part: string; direction?: "previous" | "next" }>
  | Readonly<{ type: "assistance-requested"; region: Region }>
  | Readonly<{ type: "calculation-checked"; calculation: Calculation }>
  | Readonly<{ type: "attempt-completed"; result: LegacyIntegrationResult }>
  | Readonly<{ type: "attempt-restarted"; nextAttemptId: string }>
  | Readonly<{ type: "attempt-exited" }>;
export type LegacyIntegrationEvent = Detail & Readonly<{
  schemaVersion: 1; activityVersion: 1; activityId: "integration-area";
  attemptId: string; attemptNumber: number; eventId: string; sequence: number; stage: Stage;
}>;
export type LegacyIntegrationRecords = Readonly<{
  current: LegacyIntegrationAttempt; events: readonly LegacyIntegrationEvent[];
  completedAttempts: readonly LegacyIntegrationResult[]; partialAttempts: readonly LegacyIntegrationAttempt[]; exited: boolean;
}>;

import type { DivisionFunction, GrowthFunction, IntegrationStage as Stage, RegionSelection } from "./model";
import type { LegacyIntegrationAttempt, LegacyIntegrationEvent, LegacyIntegrationRecords, LegacyIntegrationResult } from "./legacy-records";
export type { LegacyIntegrationAttempt, LegacyIntegrationEvent, LegacyIntegrationRecords, LegacyIntegrationResult } from "./legacy-records";

export type IntegrationStage = Stage;
export type Region = RegionSelection;
export type DivisionSubsection = "rising" | "square" | "rule";
/** Optional for historical v2 payloads; all new live arrival events include this context. */
export type IntegrationView = Readonly<{ region: Region; subsection?: GrowthFunction | "rule" }>;
export type Prediction = Readonly<{ function: GrowthFunction; multiplier: number; observed: boolean; correct: boolean | null }>;
export type Calculation = Readonly<{ number: number; region: Region; submitted: number; expected: number; correct: boolean; assisted: boolean; problemRevision: number; answerRevision: number }>;
export type IntegrationAttemptV2 = Readonly<{
  schemaVersion: 2; activityVersion: 2; activityId: "integration-area";
  attemptId: string; attemptNumber: number; stage: IntegrationStage; stageId: string;
  status: "in-progress" | "completed" | "restarted" | "exited";
  region: Region; predictions: readonly Prediction[]; checks: readonly Calculation[];
  assistanceRequested: boolean; successMode: "independent" | "assisted" | null;
}>;
export type IntegrationResultV2 = IntegrationAttemptV2 & Readonly<{
  status: "completed"; successMode: "independent" | "assisted" | null; area: number;
  outcome: "correct" | "incorrect"; finalCalculation: Calculation;
}>;
export type IntegrationEventDetail =
  | Readonly<{ type: "attempt-started"; view?: IntegrationView }>
  | Readonly<{ type: "boundary-committed"; boundary: "a" | "b"; from: number; to: number; input: "pointer" | "keyboard" | "value" }>
  | Readonly<{ type: "function-selected"; function: GrowthFunction }>
  | Readonly<{ type: "division-mode-selected"; function: DivisionFunction }>
  | Readonly<{ type: "division-rule-viewed" }>
  | Readonly<{ type: "comparison-demonstrated"; function: GrowthFunction; from: 2; to: 4 }>
  | Readonly<{ type: "refinement-changed"; rectangles: number }>
  | Readonly<{ type: "prediction-submitted" | "prediction-tested"; prediction: Prediction }>
  | Readonly<{ type: "region-selected"; region: Region }>
  | Readonly<{ type: "interval-selected"; region: Region }>
  | Readonly<{ type: "stage-changed"; from: IntegrationStage; to: IntegrationStage; part: string; direction?: "previous" | "next"; view?: IntegrationView }>
  | Readonly<{ type: "assistance-requested"; region: Region }>
  | Readonly<{ type: "calculation-checked"; calculation: Calculation }>
  | Readonly<{ type: "attempt-completed"; result: IntegrationResultV2 }>
  | Readonly<{ type: "attempt-restarted"; nextAttemptId: string }>
  | Readonly<{ type: "attempt-exited" }>;
export type IntegrationEventV2 = IntegrationEventDetail & Readonly<{
  schemaVersion: 2; activityVersion: 2; activityId: "integration-area";
  attemptId: string; attemptNumber: number; eventId: string; sequence: number; stage: IntegrationStage; stageId: string;
}>;
export type IntegrationRecordsV2 = Readonly<{
  current: IntegrationAttemptV2; events: readonly IntegrationEventV2[];
  completedAttempts: readonly IntegrationResultV2[]; partialAttempts: readonly IntegrationAttemptV2[];
  exited: boolean;
}>;
/** Public consumers narrow by version; the live seven-stage reducer produces v2 only. */
export type IntegrationAttempt = LegacyIntegrationAttempt | IntegrationAttemptV2;
export type IntegrationResult = LegacyIntegrationResult | IntegrationResultV2;
export type IntegrationEvent = LegacyIntegrationEvent | IntegrationEventV2;
export type IntegrationRecords = LegacyIntegrationRecords | IntegrationRecordsV2;
export type IntegrationCallbacks = Readonly<{
  onEvent?: (event: IntegrationEvent) => void;
  onComplete?: (result: IntegrationResult) => void;
  onRecordsChange?: (records: IntegrationRecords) => void;
}>;

import { assertAdoption, assertCardContent, isRecord, nonblank, requireCondition } from "./domain";
import type { CardContent, CardData } from "./model";
import type { CompletionStatus } from "../../components/decks/types";

// Deliberately excludes adoption, dates, tests, history and private contributions.
// Selecting a content version is a caller authorization concern, not ownership
// of another learning record. This module performs no access checks or DB reads.
export type LearningFields = Pick<CardData, "items" | "signalReadings">;
export type PersonalLearningChange =
  | { kind: "completion"; stepId: string; completionStatus: CompletionStatus }
  | { kind: "signal"; stepId: string; reading: number | null };

export function assertLearningFields(data: LearningFields) {
  requireCondition(data && Array.isArray(data.items) && Array.isArray(data.signalReadings), "INVALID_CARD_DATA");
  const completions = new Set<string>(), signals = new Set<string>();
  for (const item of data.items) {
    requireCondition(isRecord(item) && nonblank(item.stepId) && !completions.has(item.stepId)
      && ["todo", "inProgress", "done", "skipped"].includes(item.completionStatus), "INVALID_COMPLETION");
    completions.add(item.stepId);
  }
  for (const signal of data.signalReadings) {
    requireCondition(isRecord(signal) && nonblank(signal.stepId) && !signals.has(signal.stepId)
      && (signal.reading === null || typeof signal.reading === "number" && Number.isFinite(signal.reading)
        && signal.reading >= 1 && signal.reading <= 10), "INVALID_SIGNAL_READING");
    signals.add(signal.stepId);
  }
}

// Always constructs an allowlist. Even a full owner record passed here cannot
// leak a private field through object spreading or a retained Step entry.
export function projectLearning(content: CardContent, data: LearningFields): LearningFields {
  assertCardContent(content); assertLearningFields(data);
  const completions = new Map(data.items.map(item => [item.stepId, item.completionStatus]));
  const readings = new Map(data.signalReadings.map(signal => [signal.stepId, signal.reading]));
  return {
    items: content.steps.map(({ stepId }) => ({ stepId, completionStatus: completions.get(stepId) ?? "todo" })),
    signalReadings: content.steps.map(({ stepId }) => ({ stepId, reading: readings.get(stepId) ?? null })),
  };
}

export function reconcileLearning(data: LearningFields, content: CardContent): LearningFields {
  const selected = projectLearning(content, data);
  const completions = new Set(data.items.map(item => item.stepId));
  const signals = new Set(data.signalReadings.map(signal => signal.stepId));
  return {
    items: [...data.items.map(({ stepId, completionStatus }) => ({ stepId, completionStatus })),
      ...selected.items.filter(item => !completions.has(item.stepId))],
    signalReadings: [...data.signalReadings.map(({ stepId, reading }) => ({ stepId, reading })),
      ...selected.signalReadings.filter(signal => !signals.has(signal.stepId))],
  };
}

export function assertLearningChange(content: CardContent, change: PersonalLearningChange) {
  assertCardContent(content);
  requireCondition(isRecord(change) && nonblank(change.stepId)
    && content.steps.some(step => step.stepId === change.stepId), "STEP_OUTSIDE_ADOPTED_CARD");
  if (change.kind === "completion") {
    requireCondition(["todo", "inProgress", "done", "skipped"].includes(change.completionStatus), "INVALID_COMPLETION");
  } else {
    requireCondition(change.kind === "signal" && (change.reading === null || typeof change.reading === "number"
      && Number.isFinite(change.reading) && change.reading >= 1 && change.reading <= 10), "INVALID_SIGNAL_READING");
  }
}

export function projectPersonalLearning(cardTemplateId: string, version: number, content: CardContent,
  records: readonly Pick<CardData, "cardTemplateId" | "items" | "signalReadings">[], allowUnstarted = false) {
  requireCondition(nonblank(cardTemplateId), "INVALID_ENTITY_ID"); assertAdoption(version);
  const found = records.filter(record => record.cardTemplateId === cardTemplateId);
  requireCondition(found.length <= 1, "AMBIGUOUS_CARD_DATA");
  requireCondition(found.length === 1 || allowUnstarted, "MISSING_CARD_DATA");
  return { cardTemplateId, version, ...projectLearning(content, found[0] ?? { items: [], signalReadings: [] }) };
}

import { CardArchitectureError, assertAdoption, assertCardContent, isRecord, nonblank, requireCondition } from "./domain";
import type { CardContent, CardData } from "./model";

// A review pins only changes this operation may adopt. Existing global CardData
// never becomes a freshness dependency of a Deck Update.
export type UpdateCommand = {
  viewerUserId: string;
  kind: "card" | "deck";
  entityId: string;
  adoptedVersion: number;
  targetVersion: number;
  missingCards: { cardTemplateId: string; version: number }[];
};
export type UpdateReview = {
  command: UpdateCommand;
  title: string;
  notes: { version: number; updateNote: string }[];
};
export type UpdateReviewResult = { viewerUserId: string; review: UpdateReview | null };
export type UpdateAdoptionResult = {
  viewerUserId: string;
  kind: UpdateCommand["kind"];
  entityId: string;
  outcome: "updated" | "already-adopted" | "superseded";
  adoptedVersion: number;
  latestVersion: number;
  membershipState?: "active" | "archived";
  adoptedCards?: { cardTemplateId: string; version: number }[];
};
export class UpdateReviewConflict extends CardArchitectureError {
  constructor(readonly latestReview: UpdateReviewResult) { super("UPDATE_REVIEW_CONFLICT"); }
}

export function assertUpdateCommand(value: unknown): asserts value is UpdateCommand {
  requireCondition(isRecord(value) && Object.keys(value).length === 6
    && Object.keys(value).every((key) => ["viewerUserId", "kind", "entityId", "adoptedVersion", "targetVersion", "missingCards"].includes(key))
    && nonblank(value.viewerUserId) && nonblank(value.entityId) && value.entityId.length <= 200
    && (value.kind === "card" || value.kind === "deck"), "INVALID_UPDATE_COMMAND");
  assertAdoption(value.adoptedVersion); assertAdoption(value.targetVersion);
  requireCondition(Number.isSafeInteger(value.adoptedVersion) && Number.isSafeInteger(value.targetVersion)
    && value.targetVersion > value.adoptedVersion && Array.isArray(value.missingCards)
    && (value.kind !== "card" || value.missingCards.length === 0), "INVALID_UPDATE_COMMAND");
  const ids = new Set<string>();
  for (const ref of value.missingCards) {
    requireCondition(isRecord(ref) && Object.keys(ref).length === 2
      && nonblank(ref.cardTemplateId) && ref.cardTemplateId.length <= 200
      && Number.isSafeInteger(ref.version) && Number(ref.version) >= 1 && !ids.has(ref.cardTemplateId), "INVALID_UPDATE_COMMAND");
    ids.add(ref.cardTemplateId);
  }
}

// Only writable current Step projections change. Historical/contextual fields,
// target dates and reflection are not re-created or copied during adoption.
// Keep values for temporarily absent IDs, so a returning stable ID retains them.
export function reconcileCardUpdate(data: CardData, target: CardContent) {
  assertCardContent(target);
  requireCondition(Array.isArray(data.items) && Array.isArray(data.signalReadings), "INVALID_CARD_DATA");
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
  return {
    items: [...data.items, ...target.steps.filter((step) => !completions.has(step.stepId)).map(({ stepId }) => ({ stepId, completionStatus: "todo" as const }))],
    signalReadings: [...data.signalReadings, ...target.steps.filter((step) => !signals.has(step.stepId)).map(({ stepId }) => ({ stepId, reading: null }))],
  };
}

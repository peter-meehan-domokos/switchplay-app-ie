import { assertAdoption, assertCardContent, initialCardData, isRecord, nonblank, requireCondition } from "./domain";
import { isIsoDateOnlyString } from "../dateOnly";
import { sameContent } from "./publicationRules";
import type { CardContent, CardData, CardForkSource, ForkContext } from "./model";
import { readablePersonalHistory } from "./personalHistory";

export function assertForkContext(value: unknown): asserts value is ForkContext {
  requireCondition(isRecord(value) && (value.kind === "library" && Object.keys(value).length === 1
    || value.kind === "my-decks" && nonblank(value.deckTemplateId) && Object.keys(value).length === 2), "INVALID_FORK_CONTEXT");
}

// Callers allocate identities once. The server independently constructs/checks
// immediate lineage, including when the source itself is a fork.
export function forkCardContent(source: CardContent, ref: CardForkSource, stepIds: string[]): CardContent {
  assertCardContent(source); assertAdoption(ref.version);
  requireCondition(isRecord(ref) && Object.keys(ref).length === 2 && nonblank(ref.cardTemplateId) && Array.isArray(stepIds) && stepIds.length === source.steps.length
    && stepIds.every(nonblank) && new Set(stepIds).size === stepIds.length
    && stepIds.every((id) => !source.steps.some((step) => step.stepId === id)), "INVALID_FORK_STEP_IDS");
  return { ...structuredClone(source), steps: source.steps.map((step, index) => ({ ...structuredClone(step), stepId: stepIds[index],
    forkedFrom: { ...ref, stepId: step.stepId } })) };
}

export function editedForkContent(source: CardContent, ref: CardForkSource, stepIds: string[], edit: CardContent, visibilityEdit = false) {
  const baseline = forkCardContent(source, ref, stepIds);
  assertCardContent(edit);
  requireCondition(edit.steps.every((step) => stepIds.includes(step.stepId)), "INVALID_FORK_STEP_IDS");
  const content = { ...structuredClone(edit), steps: edit.steps.map((step) => {
    const lineage = baseline.steps.find((item) => item.stepId === step.stepId)!.forkedFrom!;
    requireCondition(step.forkedFrom === undefined || sameContent(step.forkedFrom, lineage), "INVALID_STEP_LINEAGE");
    return { ...structuredClone(step), forkedFrom: lineage };
  }) };
  requireCondition(visibilityEdit || !sameContent(content, baseline), "NO_MEANINGFUL_FORK_EDIT");
  return content;
}

// Current-state inheritance uses identity only. History remains stored once.
export function inheritForkCardData(id: string, target: CardContent, ref: CardForkSource,
  sourceContent: CardContent, adoptedSourceContent: CardContent, source: CardData, now: Date): CardData {
  assertCardContent(target); assertCardContent(sourceContent); assertCardContent(adoptedSourceContent); assertAdoption(source.cardTemplateVersion);
  requireCondition(source.cardTemplateId === ref.cardTemplateId, "INVALID_FORK_SOURCE_DATA");
  requireCondition(Array.isArray(source.items) && Array.isArray(source.signalReadings), "INVALID_FORK_SOURCE_DATA");
  requireCondition(source.targetDate === null || isIsoDateOnlyString(source.targetDate), "INVALID_TARGET_DATE");
  const data = initialCardData(id, 1, target, now);
  const lineage = new Map(target.steps.map((step) => {
    const from = step.forkedFrom;
    requireCondition(from === undefined || from.cardTemplateId === ref.cardTemplateId && from.version === ref.version
      && sourceContent.steps.some((item) => item.stepId === from.stepId), "INVALID_STEP_LINEAGE");
    // Retained personal values can outlive the adopted version's visible Steps.
    // The exact immutable fork source establishes lineage; current stored values
    // follow that stable identity, never a position or an adoption-version gate.
    return [step.stepId, from?.stepId ?? null];
  }));
  data.items = data.items.map((item) => {
    const candidates = source.items.filter((value) => value.stepId === lineage.get(item.stepId));
    requireCondition(candidates.length <= 1, "AMBIGUOUS_SOURCE_COMPLETION");
    if (!candidates.length) return item;
    requireCondition(["todo", "inProgress", "done", "skipped"].includes(candidates[0].completionStatus), "INVALID_COMPLETION");
    return { ...item, completionStatus: candidates[0].completionStatus };
  });
  data.signalReadings = data.signalReadings.map((item) => {
    const candidates = source.signalReadings.filter((value) => value.stepId === lineage.get(item.stepId));
    requireCondition(candidates.length <= 1, "AMBIGUOUS_SOURCE_SIGNAL");
    if (!candidates.length) return item;
    const reading = candidates[0].reading;
    requireCondition(reading === null || typeof reading === "number" && Number.isFinite(reading) && reading >= 1 && reading <= 10, "INVALID_SIGNAL_READING");
    return { ...item, reading };
  });
  data.targetDate = source.targetDate;
  requireCondition(typeof source.reflection === "string", "INVALID_REFLECTION");
  data.reflection = source.reflection;
  data.historySourceCardTemplateId = source.cardTemplateId;
  return data;
}

export type PersonalHistoryIssue = { code: string; cardTemplateId: string };
export function personalHistorySegments(records: CardData[], cardTemplateId: string, issues?: PersonalHistoryIssue[]) {
  const byId = new Map<string, CardData[]>();
  for (const data of records) {
    if (!isRecord(data) || !nonblank(data.cardTemplateId)) continue;
    byId.set(data.cardTemplateId, [...(byId.get(data.cardTemplateId) ?? []), data]);
  }
  requireCondition(byId.has(cardTemplateId), "MISSING_CARD_DATA");
  const segments = [], seen = new Set<string>();
  let id: string | undefined = cardTemplateId;
  while (id) {
    if (seen.has(id)) { issues?.push({ code: "PERSONAL_HISTORY_CYCLE", cardTemplateId: id }); break; }
    seen.add(id);
    const candidates = byId.get(id);
    if (!candidates || candidates.length !== 1) {
      issues?.push({ code: candidates ? "AMBIGUOUS_PERSONAL_HISTORY_SOURCE" : "MISSING_PERSONAL_HISTORY_SOURCE", cardTemplateId: id });
      break; // Deleted/ambiguous source: retain earlier segments.
    }
    const data = candidates[0];
    // Adoption describes the current record, not the historical event's version.
    segments.push({ cardTemplateId: id, currentAdoptedCardTemplateVersion: Number.isInteger(data.cardTemplateVersion) && data.cardTemplateVersion >= 1 ? data.cardTemplateVersion : null,
      eventVersionAttribution: "not-recorded" as const,
      ...readablePersonalHistory(data) });
    if (data.historySourceCardTemplateId !== undefined && !nonblank(data.historySourceCardTemplateId)) {
      issues?.push({ code: "MALFORMED_PERSONAL_HISTORY_SOURCE", cardTemplateId: id }); break;
    }
    id = nonblank(data.historySourceCardTemplateId) ? data.historySourceCardTemplateId : undefined;
  }
  return segments;
}

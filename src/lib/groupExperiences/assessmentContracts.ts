import { isRecord, requireCondition } from "../cards/domain";
import { assertAssessmentCommand, assertAssessmentSource, type AssessmentCommand, type AssessmentSource, type AssessmentTarget } from "../assessments/contracts";

export type GroupAssessmentCommand = { viewerUserId: string; target: AssessmentTarget; expectedRevision: number; id: string } & (
  { action: "add" | "update"; date: string; result: boolean } | { action: "delete" });
export function groupAssessmentSource(target: AssessmentTarget): AssessmentSource {
  requireCondition(isRecord(target) && Object.keys(target).length === 1, "INVALID_ASSESSMENT_TARGET");
  const source: AssessmentSource = "cardTemplateId" in target ? { kind: "card", cardTemplateId: target.cardTemplateId! }
    : { kind: "item", itemId: target.frameworkItemId! };
  assertAssessmentSource(source); return source;
}
export function storedGroupAssessmentCommand(command: GroupAssessmentCommand, deckTemplateId: string): AssessmentCommand {
  const { target, ...fields } = command, source = groupAssessmentSource(target);
  return { ...fields, source, ...(command.action === "add" && source.kind === "card" ? { deckTemplateId } : {}) } as AssessmentCommand;
}
export function assertGroupAssessmentCommand(value: unknown): asserts value is GroupAssessmentCommand {
  requireCondition(isRecord(value) && Object.keys(value).every(key => ["viewerUserId", "target", "expectedRevision", "id", "action", "date", "result"].includes(key)), "INVALID_ASSESSMENT_FIELDS");
  groupAssessmentSource(value.target as AssessmentTarget);
  // Reuse validation only; the actual immutable Deck context is supplied by the
  // server after Group authority resolution, never by this request body.
  assertAssessmentCommand(storedGroupAssessmentCommand(value as GroupAssessmentCommand, "server-resolved-deck"));
}

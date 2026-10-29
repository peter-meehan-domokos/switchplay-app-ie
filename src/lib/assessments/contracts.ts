import { CardArchitectureError, isRecord, nonblank, requireCondition } from "../cards/domain";
import { isIsoDateOnlyString } from "../dateOnly";

export type AssessmentSource = { kind: "card"; cardTemplateId: string } | { kind: "item"; itemId: string };
export type AssessmentResult = { id: string; date: string; result: boolean; createdAt: string };
export type AssessmentList = { viewerUserId: string; source: AssessmentSource; revision: number; tests: AssessmentResult[] };
type CommandBase = { viewerUserId: string; source: AssessmentSource; expectedRevision: number; id: string };
export type AssessmentCommand = CommandBase & (
  | { action: "add"; date: string; result: boolean; deckTemplateId?: string }
  | { action: "update"; date: string; result: boolean }
  | { action: "delete" });
export type AssessmentMutationResult = AssessmentList & { outcome: "changed" | "already-present" | "already-absent" };
export class AssessmentConflict extends CardArchitectureError {
  constructor(readonly latestList: AssessmentList) { super("ASSESSMENT_REVISION_CONFLICT"); }
}
export function assertAssessmentId(value: unknown): asserts value is string {
  requireCondition(nonblank(value) && value === value.trim() && value.length <= 200 && !/[\u0000-\u001f\u007f]/.test(value), "INVALID_ASSESSMENT_ID");
}
export function assertAssessmentSource(value: unknown): asserts value is AssessmentSource {
  requireCondition(isRecord(value) && (value.kind === "card" || value.kind === "item")
    && Object.keys(value).length === 2, "INVALID_ASSESSMENT_SOURCE");
  assertAssessmentId(value.kind === "card" ? value.cardTemplateId : value.itemId);
}
export function sameAssessmentSource(a: AssessmentSource, b: AssessmentSource) {
  return a.kind === b.kind && (a.kind === "card" ? a.cardTemplateId === (b as typeof a).cardTemplateId : a.itemId === (b as typeof a).itemId);
}
export function assertAssessmentCommand(value: unknown): asserts value is AssessmentCommand {
  requireCondition(isRecord(value), "INVALID_ASSESSMENT_COMMAND");
  assertAssessmentId(value.viewerUserId); assertAssessmentId(value.id); assertAssessmentSource(value.source);
  requireCondition(Number.isSafeInteger(value.expectedRevision) && Number(value.expectedRevision) >= 0,
    "INVALID_ASSESSMENT_REVISION");
  requireCondition(["add", "update", "delete"].includes(value.action as string), "INVALID_ASSESSMENT_COMMAND");
  const allowed = ["viewerUserId", "source", "expectedRevision", "id", "action",
    ...(value.action === "delete" ? [] : ["date", "result"]),
    ...(value.action === "add" && value.source.kind === "card" ? ["deckTemplateId"] : [])];
  requireCondition(Object.keys(value).every((key) => allowed.includes(key)), "INVALID_ASSESSMENT_FIELDS");
  if (value.action !== "delete") requireCondition(isIsoDateOnlyString(value.date) && value.date === value.date.trim()
    && typeof value.result === "boolean", "INVALID_ASSESSMENT_RESULT");
  if (value.action === "add" && value.source.kind === "card") assertAssessmentId(value.deckTemplateId);
}
export function assessmentRevision(value: unknown): number {
  requireCondition(value === undefined || Number.isSafeInteger(value) && Number(value) >= 0, "INVALID_STORED_ASSESSMENT_REVISION");
  return value === undefined ? 0 : value as number;
}
// Recognise current desired state only, never claim an exact operation receipt.
// A stale absent Add is always a conflict, so a deleted result cannot resurrect.
export function reconcileAssessment(command: AssessmentCommand, list: AssessmentList): "already-present" | "already-absent" | null {
  requireCondition(command.viewerUserId === list.viewerUserId && sameAssessmentSource(command.source, list.source), "ASSESSMENT_SESSION_CONFLICT");
  if (list.revision <= command.expectedRevision) return null;
  const test = list.tests.find((test) => test.id === command.id);
  if (command.action === "delete") return test ? null : "already-absent";
  return test && test.date === command.date && test.result === command.result ? "already-present" : null;
}
export function newestAssessmentsFirst(tests: readonly AssessmentResult[]): AssessmentResult[] {
  const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
  return [...tests].sort((a, b) => compare(b.date, a.date) || compare(b.createdAt, a.createdAt) || compare(a.id, b.id));
}

import { isIntegrationSnapshot } from "../../app/step-visuals/activities/integration-area/hostState";
import { isRootsSnapshot } from "../../app/step-visuals/activities/roots-factors/hostState";
import { resolveInteractiveVisual } from "../interactiveVisuals/catalogue";
import { isHostedRootsEvent } from "../../app/step-visuals/activities/roots-factors/eventValidation";
import { isHostedIntegrationEvent } from "../../app/step-visuals/activities/integration-area/eventValidation";
import type { LearnerPrincipal, NewVisualAttempt, VisualBatch, VisualSnapshot, VisualSource } from "./model";

export class VisualRecordError extends Error {
  constructor(readonly code: string) { super(code); this.name = "VisualRecordError"; }
}
export function requireVisual(condition: unknown, code: string): asserts condition { if (!condition) throw new VisualRecordError(code); }
export const recordObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
export const exactFields = (v: Record<string, unknown>, names: readonly string[]) => Object.keys(v).length === names.length && names.every(n => Object.hasOwn(v, n));
export const safeCount = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) >= 0 && Number(v) < Number.MAX_SAFE_INTEGER - 100;
export const safeId = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9_-]{1,200}$/.test(v);
export function assertUuid(v: unknown): asserts v is string { requireVisual(typeof v === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v), "INVALID_VISUAL_ID"); }
export function principalKey(p: LearnerPrincipal) {
  requireVisual(p && (p.kind === "account" || p.kind === "guest") && safeId(p.id), "INVALID_LEARNER_PRINCIPAL");
  return `${p.kind}:${p.id}`;
}
/** Reject pathological payloads before recursion, hashing, BSON or rendering. No silent trimming. */
export function assertBoundedJson(value: unknown, maxBytes = 256 * 1024) {
  let nodes = 0;
  const walk = (v: unknown, depth: number): void => {
    requireVisual(++nodes <= 20000 && depth <= 16, "VISUAL_PAYLOAD_LIMIT");
    if (v === null || typeof v === "boolean" || typeof v === "number" && Number.isFinite(v)) return;
    if (typeof v === "string") { requireVisual(v.length <= 4096, "VISUAL_PAYLOAD_LIMIT"); return; }
    if (Array.isArray(v)) { requireVisual(v.length <= 1000, "VISUAL_PAYLOAD_LIMIT"); for (const item of v) walk(item, depth + 1); return; }
    requireVisual(recordObject(v) && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null), "INVALID_VISUAL_PAYLOAD");
    for (const [key, child] of Object.entries(v)) {
      requireVisual(key.length <= 100 && !["__proto__", "prototype", "constructor"].includes(key) && !key.startsWith("$") && !key.includes("."), "INVALID_VISUAL_PAYLOAD");
      walk(child, depth + 1);
    }
  };
  walk(value, 0);
  requireVisual(new TextEncoder().encode(JSON.stringify(value)).length <= maxBytes, "VISUAL_PAYLOAD_LIMIT");
}
export function assertVisualSource(v: unknown): asserts v is VisualSource {
  requireVisual(recordObject(v) && ["direct", "card", "framework"].includes(String(v.kind)), "INVALID_VISUAL_SOURCE");
  const allowed = v.kind === "card" ? ["kind", "cardId", "cardVersion", "deckId", "stepId", "attachmentId", "journeyId"]
    : v.kind === "framework" ? ["kind", "frameworkId", "frameworkItemId", "journeyId"] : ["kind", "journeyId"];
  requireVisual(Object.keys(v).every(k => allowed.includes(k)) && Object.entries(v).every(([k, val]) => k === "kind" || k === "cardVersion" ? true : safeId(val)), "INVALID_VISUAL_SOURCE");
  if (v.kind === "card") requireVisual(safeId(v.cardId) && safeId(v.stepId) && safeId(v.attachmentId) && safeCount(v.cardVersion) && v.cardVersion >= 1, "INVALID_VISUAL_SOURCE");
  if (v.kind === "framework") requireVisual(safeId(v.frameworkId) && safeId(v.frameworkItemId), "INVALID_VISUAL_SOURCE");
}
export function assertVisualSnapshot(v: unknown, activityId: string, attemptId: string): asserts v is VisualSnapshot {
  assertBoundedJson(v, 128 * 1024);
  requireVisual((isRootsSnapshot(v) || isIntegrationSnapshot(v)) && v.activityId === activityId, "INVALID_VISUAL_SNAPSHOT");
  requireVisual(v.activityId === activityId && v.attemptId === attemptId, "VISUAL_SNAPSHOT_IDENTITY_MISMATCH");
}
const eventTypes: Readonly<Record<string, readonly string[]>> = {
  "roots-and-factors": ["attempt-started", "root-placed", "prediction-submitted", "prediction-tested", "stage-changed", "answer-checked", "assistance-requested", "attempt-completed"],
  "integration-area": ["attempt-started", "boundary-committed", "function-selected", "division-mode-selected", "division-rule-viewed", "comparison-demonstrated", "refinement-changed", "prediction-submitted", "prediction-tested", "region-selected", "interval-selected", "stage-changed", "assistance-requested", "calculation-checked", "attempt-completed"],
};
export function assertVisualBatch(v: unknown, activityId: string, attemptId: string): asserts v is VisualBatch {
  assertBoundedJson(v);
  requireVisual(recordObject(v) && exactFields(v, ["writeId", "expectedStateRevision", "visitId", "activityVersion", "snapshotSchema", "events", "snapshot"]), "INVALID_VISUAL_BATCH");
  assertUuid(v.writeId); assertUuid(v.visitId);
  const release = resolveInteractiveVisual(activityId);
  requireVisual(release && v.activityVersion === release.activityVersion && v.snapshotSchema === release.snapshotSchema, "VISUAL_RELEASE_MISMATCH");
  requireVisual(safeCount(v.expectedStateRevision) && Array.isArray(v.events) && v.events.length <= 100, "INVALID_VISUAL_BATCH");
  assertVisualSnapshot(v.snapshot, activityId, attemptId);
  const ids = new Set<string>();
  for (const e of v.events) {
    requireVisual(recordObject(e) && exactFields(e, ["eventId", "writerId", "clientSequence", "clientOccurredAt", "activityVersion", "eventSchema", "type", "payload"]), "INVALID_VISUAL_EVENT");
    assertUuid(e.eventId); assertUuid(e.writerId);
    requireVisual(!ids.has(e.eventId), "DUPLICATE_VISUAL_EVENT"); ids.add(e.eventId);
    requireVisual(safeCount(e.clientSequence) && e.clientSequence > 0 && typeof e.clientOccurredAt === "string"
      && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(e.clientOccurredAt) && Number.isFinite(Date.parse(e.clientOccurredAt))
      && e.activityVersion === release.activityVersion && e.eventSchema === release.eventSchema
      && typeof e.type === "string" && eventTypes[activityId]?.includes(e.type) && recordObject(e.payload)
      && e.payload.type === e.type && e.payload.activityId === activityId && e.payload.activityVersion === release.activityVersion
      && e.payload.schemaVersion === release.eventSchema && e.payload.attemptId === attemptId
      && safeCount(e.payload.sequence) && e.payload.sequence > 0 && typeof e.payload.eventId === "string"
      && e.payload.eventId === `${attemptId}:${e.payload.sequence}`, "INVALID_VISUAL_EVENT");
    requireVisual(activityId === "roots-and-factors" ? isHostedRootsEvent(e.payload) : isHostedIntegrationEvent(e.payload), "INVALID_VISUAL_EVENT");
  }
}
export function assertNewVisualAttempt(v: unknown): asserts v is NewVisualAttempt {
  requireVisual(recordObject(v) && exactFields(v, ["commandId", "attemptId", "expectedActiveAttemptId"]), "INVALID_VISUAL_ATTEMPT_COMMAND");
  assertUuid(v.commandId); assertUuid(v.attemptId); assertUuid(v.expectedActiveAttemptId);
}

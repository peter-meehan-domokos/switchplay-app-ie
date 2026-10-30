import { CardArchitectureError } from "../cards/domain";
import { resolveInteractiveVisual } from "../interactiveVisuals/catalogue";
import { assertNewVisualAttempt, assertUuid, assertVisualSource, exactFields, principalKey, recordObject, requireVisual, VisualRecordError } from "./contracts";
import type { LearnerPrincipal, VisualAttempt, VisualBatch, VisualRecord, VisualSource } from "./model";
import type { VisualLearningRecordRepository } from "./repository";

export type VisualApiDependencies = Readonly<{
  enabled: boolean;
  expectedOrigin?: string;
  authenticate: () => Promise<LearnerPrincipal | null>;
  consumeBudget?: (principal: string) => boolean;
  repository: () => Promise<VisualLearningRecordRepository>;
  authorizeSource: (actor: LearnerPrincipal, activityId: string, source: VisualSource) => Promise<VisualSource>;
}>;
const privateHeaders = { "Cache-Control": "private, no-store", Vary: "Cookie, X-Visual-Learner" };
export async function readVisualJson(request: Request, maxBytes = 256 * 1024): Promise<unknown> {
  requireVisual(request.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase() === "application/json", "INVALID_VISUAL_CONTENT_TYPE");
  const size = request.headers.get("Content-Length");
  requireVisual(size === null || /^\d+$/.test(size) && Number(size) <= maxBytes, "VISUAL_PAYLOAD_LIMIT");
  const reader = request.body?.getReader(); requireVisual(reader, "INVALID_VISUAL_JSON");
  let bytes = 0, text = ""; const decoder = new TextDecoder("utf-8", { fatal: true });
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      bytes += part.value.byteLength; requireVisual(bytes <= maxBytes, "VISUAL_PAYLOAD_LIMIT");
      text += decoder.decode(part.value, { stream: true });
    }
    text += decoder.decode(); return JSON.parse(text);
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
export function visualSessionDto(actor: LearnerPrincipal, record: VisualRecord, attempt: VisualAttempt, visitId?: string) {
  return { learner: principalKey(actor), recordId: record.recordId, activityId: record.activityId, activeAttemptId: record.activeAttemptId,
    attemptId: attempt.attemptId, attemptNumber: attempt.attemptNumber, stateRevision: attempt.stateRevision,
    activityVersion: attempt.activityVersion, snapshotSchema: attempt.snapshotSchema, snapshot: attempt.snapshot,
    ...(visitId ? { visitId } : {}), release: resolveInteractiveVisual(record.activityId) };
}
export function createVisualApi(deps: VisualApiDependencies) {
  async function boundary(request: Request, run: (actor: LearnerPrincipal, repo: VisualLearningRecordRepository) => Promise<unknown>) {
    let learner: string | undefined;
    try {
      if (!deps.enabled) return Response.json({ code: "VISUAL_FEATURE_DISABLED" }, { status: 404, headers: privateHeaders });
      if (request.method !== "GET") {
        // Next may construct request.url with its internal hostname (localhost), even when
        // the browser used 127.0.0.1 or a public host. HTTP Host is the browser authority;
        // never accept an arbitrary X-Forwarded-Host. A deployment may pin its public origin.
        const internal = new URL(request.url), host = request.headers.get("Host");
        const expected = deps.expectedOrigin ? new URL(deps.expectedOrigin).origin : new URL(host ? `${internal.protocol}//${host}` : internal.origin).origin;
        requireVisual(request.headers.get("Origin") === expected && request.headers.get("Sec-Fetch-Site") !== "cross-site", "VISUAL_ORIGIN_FORBIDDEN");
      }
      const actor = await deps.authenticate();
      if (!actor) return Response.json({ code: "UNAUTHENTICATED" }, { status: 401, headers: privateHeaders });
      learner = principalKey(actor);
      requireVisual(request.headers.get("X-Visual-Learner") === learner, "VISUAL_SESSION_CONFLICT");
      if (deps.consumeBudget && !deps.consumeBudget(learner)) return Response.json({ code: "VISUAL_RATE_LIMIT" },
        { status: 429, headers: { ...privateHeaders, "X-Visual-Learner": learner, "Retry-After": "60" } });
      const result = await run(actor, await deps.repository());
      return Response.json(result, { headers: { ...privateHeaders, "X-Visual-Learner": learner } });
    } catch (error) {
      const code = error instanceof VisualRecordError || error instanceof CardArchitectureError ? error.code
        : error instanceof SyntaxError || error instanceof TypeError ? "INVALID_VISUAL_JSON" : "VISUAL_REQUEST_FAILED";
      const status = code.includes("FORBIDDEN") ? 403 : code.includes("CONFLICT") || code.includes("MISMATCH") ? 409
        : code.includes("LIMIT") ? 413 : code === "VISUAL_UNAVAILABLE" ? 404 : code === "VISUAL_REQUEST_FAILED" || code.includes("SETUP_REQUIRED") ? 503 : 400;
      return Response.json({ code }, { status, headers: { ...privateHeaders, ...(learner ? { "X-Visual-Learner": learner } : {}) } });
    }
  }
  return {
    open: (request: Request) => boundary(request, async (actor, repo) => {
      const body = await readVisualJson(request, 8192);
      requireVisual(recordObject(body) && exactFields(body, ["activityId", "visitId", "source"]), "INVALID_VISUAL_OPEN");
      requireVisual(typeof body.activityId === "string" && resolveInteractiveVisual(body.activityId), "VISUAL_UNAVAILABLE"); assertUuid(body.visitId); assertVisualSource(body.source);
      const source = await deps.authorizeSource(actor, body.activityId, body.source);
      const opened = await repo.open(actor, body.activityId, body.visitId, source);
      return visualSessionDto(actor, opened.record, opened.attempt, opened.visit.visitId);
    }),
    current: (request: Request, recordId: string) => boundary(request, async (actor, repo) => {
      const current = await repo.current(actor, recordId); return visualSessionDto(actor, current.record, current.attempt);
    }),
    batch: (request: Request, attemptId: string) => boundary(request, async (actor, repo) => repo.append(actor, attemptId, await readVisualJson(request) as VisualBatch)),
    newAttempt: (request: Request, recordId: string) => boundary(request, async (actor, repo) => {
      const body = await readVisualJson(request, 4096); assertNewVisualAttempt(body);
      const attempt = await repo.newAttempt(actor, recordId, body);
      const { record } = await repo.current(actor, recordId);
      return visualSessionDto(actor, record, attempt);
    }),
  };
}

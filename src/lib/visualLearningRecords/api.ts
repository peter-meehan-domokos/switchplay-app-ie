import { CardArchitectureError } from "../cards/domain";
import { resolveInteractiveVisual } from "../interactiveVisuals/catalogue";
import { assertNewVisualAttempt, assertUuid, assertVisualSource, exactFields, principalKey, recordObject, requireVisual, VisualRecordError } from "./contracts";
import type { LearnerPrincipal, VisualAttempt, VisualBatch, VisualRecord, VisualSource } from "./model";
import type { VisualLearningRecordRepository } from "./repository";
import { inspectVisualRestoration } from "./restoration";

export type VisualApiDependencies = Readonly<{
  expectedOrigin?: string;
  authenticate: () => Promise<LearnerPrincipal | null>;
  consumeBudget?: (principal: string) => boolean;
  repository: () => Promise<VisualLearningRecordRepository>;
  authorizeSource: (actor: LearnerPrincipal, activityId: string, source: VisualSource) => Promise<VisualSource>;
}>;
const privateHeaders = { "Cache-Control": "private, no-store", Vary: "Cookie, X-Visual-Learner" };
export function assertVisualMutationOrigin(request: Request, expectedOrigin?: string) {
  const internal = new URL(request.url), host = request.headers.get("Host");
  const expected = expectedOrigin ? new URL(expectedOrigin).origin : new URL(host ? `${internal.protocol}//${host}` : internal.origin).origin;
  requireVisual(request.headers.get("Origin") === expected && request.headers.get("Sec-Fetch-Site") !== "cross-site", "VISUAL_ORIGIN_FORBIDDEN");
}
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
export function visualSessionDto(actor: LearnerPrincipal, record: VisualRecord, attempt: VisualAttempt, visitId?: string, disabledIds: readonly string[] = []) {
  const release = resolveInteractiveVisual(record.activityId, { disabledIds });
  const restoration = inspectVisualRestoration(attempt, release);
  return { learner: principalKey(actor), recordId: record.recordId, activityId: record.activityId, activeAttemptId: record.activeAttemptId,
    attemptId: attempt.attemptId, attemptNumber: attempt.attemptNumber, nextAttemptNumber: record.attemptCount + 1, stateRevision: attempt.stateRevision,
    activityVersion: attempt.activityVersion, snapshotSchema: attempt.snapshotSchema, snapshot: restoration.status === "ready" ? attempt.snapshot : null,
    ...(visitId ? { visitId } : {}), release, restoration };
}
export function createVisualApi(deps: VisualApiDependencies) {
  async function boundary(request: Request, run: (actor: LearnerPrincipal, repo: VisualLearningRecordRepository) => Promise<unknown>) {
    let learner: string | undefined;
    try {
      if (request.method !== "GET") {
        // Next may construct request.url with its internal hostname (localhost), even when
        // the browser used 127.0.0.1 or a public host. HTTP Host is the browser authority;
        // never accept an arbitrary X-Forwarded-Host. A deployment may pin its public origin.
        assertVisualMutationOrigin(request, deps.expectedOrigin);
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
      const status = code === "VISUAL_RATE_LIMIT" ? 429 : code.includes("FORBIDDEN") ? 403 : code.includes("CONFLICT") || code.includes("MISMATCH") || code.includes("RESTORATION_REQUIRED") ? 409
        : code.includes("LIMIT") ? 413 : code === "VISUAL_UNAVAILABLE" ? 404 : code === "VISUAL_REQUEST_FAILED" || code.includes("SETUP_REQUIRED") ? 503 : 400;
      return Response.json({ code }, { status, headers: { ...privateHeaders, ...(status === 429 ? { "Retry-After": "60" } : {}), ...(learner ? { "X-Visual-Learner": learner } : {}) } });
    }
  }
  return {
    existing: (request: Request) => boundary(request, async (actor, repo) => {
      const query = new URL(request.url).searchParams;
      requireVisual([...query.keys()].every(key => key === "activityId") && query.getAll("activityId").length === 1, "INVALID_VISUAL_QUERY");
      const activityId = query.get("activityId")!;
      requireVisual(!!resolveInteractiveVisual(activityId), "VISUAL_UNAVAILABLE");
      return { hasAttempt: await repo.hasAttempt(actor, activityId) };
    }),
    open: (request: Request) => boundary(request, async (actor, repo) => {
      const body = await readVisualJson(request, 8192);
      requireVisual(recordObject(body) && exactFields(body, ["activityId", "visitId", "source"]), "INVALID_VISUAL_OPEN");
      requireVisual(typeof body.activityId === "string" && resolveInteractiveVisual(body.activityId), "VISUAL_UNAVAILABLE"); assertUuid(body.visitId); assertVisualSource(body.source);
      const replay = await repo.replayOpen(actor, body.activityId, body.visitId, body.source);
      if (replay) return visualSessionDto(actor, replay.record, replay.attempt, replay.visit.visitId, repo.disabledIds);
      const source = await deps.authorizeSource(actor, body.activityId, body.source);
      const opened = await repo.open(actor, body.activityId, body.visitId, source);
      return visualSessionDto(actor, opened.record, opened.attempt, opened.visit.visitId, repo.disabledIds);
    }),
    current: (request: Request, recordId: string) => boundary(request, async (actor, repo) => {
      const current = await repo.current(actor, recordId); return visualSessionDto(actor, current.record, current.attempt, undefined, repo.disabledIds);
    }),
    batch: (request: Request, attemptId: string) => boundary(request, async (actor, repo) => repo.append(actor, attemptId, await readVisualJson(request) as VisualBatch)),
    recovery: (request: Request, attemptId: string) => boundary(request, async (actor, repo) => repo.preserveRecovery(actor, attemptId, await readVisualJson(request) as VisualBatch)),
    checkpoint: (request: Request, attemptId: string) => boundary(request, async (actor, repo) => repo.preserveMigration(actor, attemptId, await readVisualJson(request))),
    newAttempt: (request: Request, recordId: string) => boundary(request, async (actor, repo) => {
      const body = await readVisualJson(request, 4096); assertNewVisualAttempt(body);
      const attempt = await repo.newAttempt(actor, recordId, body);
      const { record } = await repo.current(actor, recordId);
      return visualSessionDto(actor, record, attempt, undefined, repo.disabledIds);
    }),
  };
}

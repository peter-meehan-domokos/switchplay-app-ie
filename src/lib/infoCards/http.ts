import { creatorRequestBoundary } from "../cards/http";
import { CardArchitectureError, requireCondition } from "../cards/domain";
import { InfoCapacityError, InfoCardRepository, InfoReferenceError } from "./repository";
import { InfoMathsError } from "./mathsValidation";
import type { InfoQuery } from "./queries";

export async function infoRequest(request: Request, run: (repo: InfoCardRepository, actor: string) => Promise<unknown>) {
  let direct: Response | undefined;
  let detail: InfoCapacityError | InfoReferenceError | undefined;
  let mathsError: InfoMathsError | undefined;
  let unavailable: string | undefined;
  const response = await creatorRequestBoundary(request, async (main, actor) => {
    requireCondition(!request.headers.has("X-Library-Viewer") || request.headers.get("X-Library-Viewer") === actor, "INFO_SESSION_CONFLICT");
    try {
      const repo = new InfoCardRepository(main.db, main.client); await repo.assertIndexesReady();
      const value = await run(repo, actor);
      if (value instanceof Response) { direct = value; return { ok: true }; }
      return value;
    } catch (error) {
      if (error instanceof InfoMathsError) mathsError = error;
      if (error instanceof InfoCapacityError || error instanceof InfoReferenceError) detail = error;
      if (error instanceof CardArchitectureError && ["INFO_INDEX_SETUP_REQUIRED", "INFO_MEDIA_PROVIDER_VERIFICATION_REQUIRED"].includes(error.code)) unavailable = error.code;
      throw error;
    }
  });
  if (mathsError) return Response.json({ error: mathsError.code, publicationNotCommitted: true, measurement: mathsError.measurement, failure: mathsError.failure }, { status: mathsError.code === "INFO_MATHS_UNAVAILABLE" ? 503 : 422, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
  if (unavailable) return Response.json({ error: unavailable }, { status: 503, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
  if (detail) return Response.json({ error: detail.code,
    ...(detail instanceof InfoCapacityError ? { capacity: detail.capacity } : { blockers: detail.blockers }) },
    { status: detail instanceof InfoReferenceError ? 409 : 422, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
  if (response.ok && direct) { direct.headers.set("Cache-Control", "private, no-store"); direct.headers.set("Vary", "Cookie"); return direct; }
  return response;
}
export function infoQuery(request: Request): InfoQuery {
  const params = new URL(request.url).searchParams;
  requireCondition([...params.keys()].every(key => ["search", "offset", "limit", "seriesId"].includes(key) && params.getAll(key).length === 1), "INVALID_INFO_QUERY");
  return { search: params.get("search") ?? "", offset: Number(params.get("offset") ?? 0), limit: Number(params.get("limit") ?? 30),
    ...(params.has("seriesId") ? { seriesId: params.get("seriesId")! } : {}) };
}

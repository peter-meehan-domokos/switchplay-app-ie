import { cardRequest } from "../cards/http";
import { requireCondition } from "../cards/domain";
import { GroupExperienceRepository } from "./repository";
import { exact } from "./contracts";
import { GroupUpdateConflict } from "./adoption";

const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
export async function groupRequest(request: Request, run: (repo: GroupExperienceRepository, actor: string) => Promise<unknown>) {
  let viewer: string | undefined;
  let conflict: GroupUpdateConflict | undefined;
  const result = await cardRequest(async (cards, actor) => {
    const expected = request.headers.get("X-Group-Viewer");
    requireCondition(expected === null || expected === actor, "GROUP_SESSION_CONFLICT"); viewer = actor;
    try { return await run(new GroupExperienceRepository(cards), actor); }
    catch (error) { if (error instanceof GroupUpdateConflict) conflict = error; throw error; }
  });
  if (conflict) return Response.json({ error: conflict.code, code: conflict.code, refreshRequired: true, latestReview: conflict.latestReview },
    { status: 409, headers: { ...headers, ...(viewer ? { "X-Group-Viewer": viewer } : {}) } });
  // Index readiness is an operational problem, not a malformed user command.
  if (result.status === 400 && (await result.clone().json()).code === "GROUP_INDEXES_NOT_READY") {
    return Response.json({ error: "GROUP_INDEXES_NOT_READY", code: "GROUP_INDEXES_NOT_READY" }, { status: 503, headers });
  }
  for (const [key, value] of Object.entries(headers)) result.headers.set(key, value);
  if (viewer) result.headers.set("X-Group-Viewer", viewer);
  return result;
}
export function query(request: Request, allowed: string[]) {
  const params = new URL(request.url).searchParams;
  requireCondition([...params.keys()].every(key => allowed.includes(key) && params.getAll(key).length === 1), "INVALID_GROUP_QUERY");
  return params;
}
export function pagination(params: URLSearchParams) { return { after: params.get("after") ?? undefined, limit: params.has("limit") ? Number(params.get("limit")) : undefined }; }
export function openCommand(value: unknown) {
  exact(value, ["accessEpoch", "cardTemplateId"]);
  return value as { accessEpoch: number; cardTemplateId?: string };
}

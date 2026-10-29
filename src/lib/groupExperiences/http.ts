import { cardRequest } from "../cards/http";
import { requireCondition } from "../cards/domain";
import { GroupExperienceRepository } from "./repository";
import { exact } from "./contracts";

const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
export async function groupRequest(request: Request, run: (repo: GroupExperienceRepository, actor: string) => Promise<unknown>) {
  // Opt-in remains an operational gate. No deployment/configuration is enabled here.
  if (process.env.SWITCHPLAY_GROUP_EXPERIENCES_ENABLED !== "1") return Response.json({ error: "Group Experiences unavailable" }, { status: 503, headers });
  let viewer: string | undefined;
  const result = await cardRequest(async (cards, actor) => {
    const expected = request.headers.get("X-Group-Viewer");
    requireCondition(expected === null || expected === actor, "GROUP_SESSION_CONFLICT"); viewer = actor;
    return run(new GroupExperienceRepository(cards), actor);
  });
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

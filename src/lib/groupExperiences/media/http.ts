import { personalUpdateRequest } from "../../cards/http";
import { CardArchitectureError, requireCondition } from "../../cards/domain";
import { GroupExperienceRepository } from "../repository";
import { groupRequest, query } from "../http";
import { GroupMediaRepository } from "./repository";
import { GroupMediaAllocationUncertain } from "./contracts";
import type { MediaAuthority } from "./model";

export function mediaAuthority(request: Request): { authority: MediaAuthority; action: "status" | "playback" | "download" | "prepare-download" | "thumbnail" } {
  const p = query(request, ["experienceId", "subjectUserId", "action"]), experienceId = p.get("experienceId"), subject = p.get("subjectUserId");
  requireCondition(experienceId !== "" && subject !== "" && (!subject || experienceId), "INVALID_GROUP_MEDIA_CONTEXT");
  const action = p.get("action") ?? "playback";
  requireCondition(["status", "playback", "download", "thumbnail"].includes(action) && (request.method !== "POST" || action === "download"), "INVALID_GROUP_MEDIA_ACTION");
  return { authority: experienceId ? { kind: "group", experienceId, ...(subject ? { subjectUserId: subject } : {}) } : { kind: "owner" },
    action: request.method === "POST" ? "prepare-download" : action as "status" | "playback" | "download" | "thumbnail" };
}
// Owner retention is independent of current Group membership.
// Group authority uses the established authenticated request boundary.
export async function mediaRequest(request: Request, groupScoped: boolean, run: (repo: GroupMediaRepository, actor: string) => Promise<unknown>) {
  let direct: Response | undefined, unavailable: string | undefined, uncertain: string | undefined;
  const execute = async (groups: GroupExperienceRepository, actor: string) => {
    requireCondition(!request.headers.has("X-Group-Viewer") || request.headers.get("X-Group-Viewer") === actor, "GROUP_SESSION_CONFLICT");
    if (!["GET", "HEAD"].includes(request.method)) {
      // Next may construct request.url with its internal hostname. The incoming
      // Host is the browser-facing authority; forwarded-host is not trusted.
      const url = new URL(request.url), host = request.headers.get("host") ?? url.host;
      const origin = new URL(`${url.protocol}//${host}`).origin;
      requireCondition(request.headers.get("sec-fetch-site") !== "cross-site" && (!request.headers.has("origin") || request.headers.get("origin") === origin), "GROUP_MEDIA_ORIGIN_FORBIDDEN");
    }
    try {
      const value = await run(new GroupMediaRepository(groups), actor);
      if (value instanceof Response) { direct = value; return { ok: true }; }
      return value;
    } catch (error) {
      if (error instanceof GroupMediaAllocationUncertain) uncertain = error.contributionId;
      if (error instanceof CardArchitectureError && ["GROUP_MEDIA_INDEXES_NOT_READY", "GROUP_MEDIA_CONFIGURATION_REQUIRED", "GROUP_MEDIA_SIGNING_UNAVAILABLE", "GROUP_MEDIA_ALLOCATION_UNCERTAIN"].includes(error.code)) unavailable = error.code;
      throw error;
    }
  };
  const response = groupScoped ? await groupRequest(request, execute) : await personalUpdateRequest(request, (cards, actor) => execute(new GroupExperienceRepository(cards), actor));
  const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
  if (unavailable) return Response.json({ error: unavailable, code: unavailable, ...(uncertain ? { contributionId: uncertain, outcome: "uncertain", retrySameOperation: true } : {}) }, { status: 503, headers });
  if (response.ok && direct) { for (const [key, value] of Object.entries(headers)) direct.headers.set(key, value); return direct; }
  return response;
}

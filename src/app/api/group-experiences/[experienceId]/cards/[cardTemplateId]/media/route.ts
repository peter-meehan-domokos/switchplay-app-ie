import { mediaRequest } from "@/lib/groupExperiences/media/http";
import { query, pagination } from "@/lib/groupExperiences/http";
import { requireCondition } from "@/lib/cards/domain";
export const runtime = "nodejs";
type Context = { params: Promise<{ experienceId: string; cardTemplateId: string }> };
export async function POST(request: Request, context: Context) {
  return mediaRequest(request, true, async (repo, actor) => {
    const { experienceId, cardTemplateId } = await context.params;
    return repo.allocate(actor, experienceId, cardTemplateId, await request.json());
  });
}
export async function GET(request: Request, context: Context) {
  return mediaRequest(request, true, async (repo, actor) => {
    const { experienceId, cardTemplateId } = await context.params, p = query(request, ["after", "before", "limit", "subjectUserId", "includeGroupContent"]);
    // Include Group content (checkpoint 4.5c): only with a follower inspection, and only as "1".
    requireCondition(!p.has("includeGroupContent") || p.get("includeGroupContent") === "1", "INVALID_GROUP_MEDIA_PAGE");
    return repo.groupFeed(actor, experienceId, cardTemplateId, { ...pagination(p), before: p.get("before") ?? undefined, subjectUserId: p.get("subjectUserId") ?? undefined,
      ...(p.has("includeGroupContent") ? { includeGroupContent: true } : {}) });
  });
}

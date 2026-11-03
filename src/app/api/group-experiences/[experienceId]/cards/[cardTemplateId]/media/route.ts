import { mediaRequest } from "@/lib/groupExperiences/media/http";
import { query, pagination } from "@/lib/groupExperiences/http";
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
    const { experienceId, cardTemplateId } = await context.params, p = query(request, ["after", "before", "limit", "subjectUserId"]);
    return repo.groupFeed(actor, experienceId, cardTemplateId, { ...pagination(p), before: p.get("before") ?? undefined, subjectUserId: p.get("subjectUserId") ?? undefined });
  });
}

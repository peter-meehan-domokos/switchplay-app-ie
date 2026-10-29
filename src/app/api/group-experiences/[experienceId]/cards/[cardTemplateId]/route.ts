import { groupRequest, query } from "@/lib/groupExperiences/http";
import type { Perspective } from "@/lib/groupExperiences/model";
export async function GET(request: Request, context: { params: Promise<{ experienceId: string; cardTemplateId: string }> }) {
  return groupRequest(request, async (repo, actor) => { const params = query(request, ["perspective", "subjectUserId"]), ids = await context.params;
    return repo.card(actor, ids.experienceId, ids.cardTemplateId, params.get("perspective") as Perspective, params.get("subjectUserId") ?? undefined); });
}

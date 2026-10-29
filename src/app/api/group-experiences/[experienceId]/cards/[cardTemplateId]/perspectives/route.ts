import { groupRequest, pagination, query } from "@/lib/groupExperiences/http";
export async function GET(request: Request, context: { params: Promise<{ experienceId: string; cardTemplateId: string }> }) {
  return groupRequest(request, async (repo, actor) => { const { after, limit } = pagination(query(request, ["after", "limit"])), ids = await context.params;
    return repo.perspectives(actor, ids.experienceId, ids.cardTemplateId, after, limit); });
}

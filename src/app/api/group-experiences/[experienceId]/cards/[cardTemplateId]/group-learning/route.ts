import { groupRequest, query } from "@/lib/groupExperiences/http";
export async function PATCH(request: Request, context: { params: Promise<{ experienceId: string; cardTemplateId: string }> }) {
  return groupRequest(request, async (repo, actor) => { query(request, []); const ids = await context.params;
    return repo.writeLearning(actor, ids.experienceId, ids.cardTemplateId, "group", await request.json()); });
}

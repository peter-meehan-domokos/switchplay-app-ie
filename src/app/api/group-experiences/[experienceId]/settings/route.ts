import { groupRequest, query } from "@/lib/groupExperiences/http";
export async function PATCH(request: Request, context: { params: Promise<{ experienceId: string }> }) {
  return groupRequest(request, async (repo, actor) => { query(request, []); return repo.saveSettings(actor, (await context.params).experienceId, await request.json()); });
}

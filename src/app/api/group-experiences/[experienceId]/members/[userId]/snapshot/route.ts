import { groupRequest, query } from "@/lib/groupExperiences/http";
export async function GET(request: Request, context: { params: Promise<{ experienceId: string; userId: string }> }) {
  return groupRequest(request, async (repo, actor) => { query(request, []); const { experienceId, userId } = await context.params; return repo.snapshot(actor, experienceId, userId); });
}

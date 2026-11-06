import { groupRequest, query } from "@/lib/groupExperiences/http";
export async function GET(request: Request, context: { params: Promise<{ experienceId: string }> }) {
  return groupRequest(request, async (repo, actor) => { query(request, []); return repo.authority(actor, (await context.params).experienceId); });
}

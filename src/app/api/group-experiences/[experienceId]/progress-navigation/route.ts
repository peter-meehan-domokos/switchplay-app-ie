import { groupRequest, query } from "@/lib/groupExperiences/http";
import { readProgressNavigation } from "@/lib/groupExperiences/progressNavigationReads";
export async function GET(request: Request, context: { params: Promise<{ experienceId: string }> }) {
  return groupRequest(request, async (repo, actor) => readProgressNavigation(repo, actor, (await context.params).experienceId, query(request, ["after"]).get("after") ?? undefined));
}

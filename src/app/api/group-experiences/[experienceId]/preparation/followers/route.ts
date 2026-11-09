import { groupRequest, query } from "@/lib/groupExperiences/http";
import { prepareFollowers } from "@/lib/groupExperiences/followerPreparation";
export function GET(request: Request, context: { params: Promise<{ experienceId: string }> }) {
  return groupRequest(request, async (repo, actor) => {
    const params = query(request, ["after"]);
    return prepareFollowers(repo, actor, (await context.params).experienceId, params.get("after") ?? undefined);
  });
}

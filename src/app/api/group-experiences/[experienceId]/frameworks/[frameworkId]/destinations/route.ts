import { groupRequest, query } from "@/lib/groupExperiences/http";
import { requireCondition } from "@/lib/cards/domain";
import { readGroupProgressDestinations } from "@/lib/groupExperiences/progressDestinations";
export async function GET(request: Request, context: { params: Promise<{ experienceId: string; frameworkId: string }> }) {
  return groupRequest(request, async (repo, actor) => {
    const params = query(request, ["itemId", "areaId", "subjectUserId"]), itemId = params.get("itemId"), areaId = params.get("areaId");
    requireCondition(Boolean(itemId) !== Boolean(areaId), "INVALID_DESTINATION_QUERY");
    const { experienceId, frameworkId } = await context.params, userId = params.get("subjectUserId");
    return readGroupProgressDestinations(repo, actor, experienceId, frameworkId, itemId ? { itemId } : { areaId: areaId! },
      userId === null ? { kind: "group" } : { kind: "player", userId });
  });
}

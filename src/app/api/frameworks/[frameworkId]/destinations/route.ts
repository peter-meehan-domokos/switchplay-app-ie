import { personalUpdateRequest } from "@/lib/cards/http";
import { requireCondition } from "@/lib/cards/domain";
import { readAreaDestinations, readItemDestinations } from "@/lib/frameworks/destinations";

export async function GET(request: Request, context: RouteContext<'/api/frameworks/[frameworkId]/destinations'>) {
  return personalUpdateRequest(request, async (repo, actor) => {
    const query = new URL(request.url).searchParams;
    const key = query.has("itemId") ? "itemId" : "areaId";
    requireCondition([...query.keys()].every((field) => field === key) && query.getAll(key).length === 1, "INVALID_DESTINATION_QUERY");
    const frameworkId = (await context.params).frameworkId;
    return key === "itemId" ? readItemDestinations(repo, actor, frameworkId, query.get(key)!)
      : readAreaDestinations(repo, actor, frameworkId, query.get(key)!);
  });
}

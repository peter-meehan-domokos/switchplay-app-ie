import { personalUpdateRequest } from "@/lib/cards/http";
import { requireCondition } from "@/lib/cards/domain";
import { readAreaDestinations } from "@/lib/frameworks/destinations";

export async function GET(request: Request, context: RouteContext<'/api/frameworks/[frameworkId]/destinations'>) {
  return personalUpdateRequest(request, async (repo, actor) => {
    const query = new URL(request.url).searchParams;
    requireCondition([...query.keys()].every((key) => key === "areaId") && query.getAll("areaId").length === 1, "INVALID_DESTINATION_QUERY");
    return readAreaDestinations(repo, actor, (await context.params).frameworkId, query.get("areaId")!);
  });
}

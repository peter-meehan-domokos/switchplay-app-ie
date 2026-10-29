import { infoRequest } from "@/lib/infoCards/http";
import { publishedSnapshot } from "@/lib/infoCards/queries";
import { requireCondition } from "@/lib/cards/domain";
export async function GET(request: Request, context: { params: Promise<{ infoCardId: string }> }) {
  return infoRequest(request, async (repo, actor) => {
    requireCondition(new URL(request.url).search === "", "INVALID_INFO_QUERY");
    return (await publishedSnapshot(repo, actor, [(await context.params).infoCardId]))[0];
  });
}

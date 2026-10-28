import { infoRequest } from "@/lib/infoCards/http";
import { requireCondition } from "@/lib/cards/domain";
import { infoDraftVideoStatus } from "@/lib/infoCards/media";

export async function GET(request: Request, context: { params: Promise<{ infoCardId: string }> }) {
  return infoRequest(request, async (repo, actor) => {
    const query = new URL(request.url).searchParams;
    requireCondition([...query.keys()].every(key => key === "revision") && query.getAll("revision").length === 1, "INVALID_INFO_MEDIA_CONTEXT");
    return infoDraftVideoStatus(repo, actor, (await context.params).infoCardId, Number(query.get("revision")));
  });
}

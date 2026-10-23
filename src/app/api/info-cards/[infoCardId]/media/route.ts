import { requireCondition } from "@/lib/cards/domain";
import { infoRequest } from "@/lib/infoCards/http";
import { deliverInfoMedia } from "@/lib/infoCards/media";
export async function GET(request: Request, context: { params: Promise<{ infoCardId: string }> }) {
  return infoRequest(request, async (repo, actor) => {
    const params = new URL(request.url).searchParams;
    requireCondition([...params.keys()].every(k => ["version", "revision"].includes(k) && params.getAll(k).length === 1) && params.has("version") !== params.has("revision"), "INVALID_INFO_MEDIA_CONTEXT");
    const { infoCardId } = await context.params;
    return deliverInfoMedia(repo, actor, params.has("version") ? { infoCardId, kind: "publication", version: Number(params.get("version")) }
      : { infoCardId, kind: "draft", revision: Number(params.get("revision")) }, request.signal);
  });
}

import { infoRequest } from "@/lib/infoCards/http";
import { requireCondition } from "@/lib/cards/domain";
import { infoDraftVideoStatus } from "@/lib/infoCards/media";

export async function GET(request: Request, context: { params: Promise<{ infoCardId: string }> }) {
  return infoRequest(request, async (repo, actor) => {
    const query = new URL(request.url).searchParams;
    requireCondition([...query.keys()].every(key => key === "revision") && query.getAll("revision").length === 1, "INVALID_INFO_MEDIA_CONTEXT");
    const id = (await context.params).infoCardId;
    const video = await infoDraftVideoStatus(repo, actor, id, Number(query.get("revision")));
    // While the editor stays open, this poll is what completes a pending Publish or Save once processing ends.
    const publication = video.status === "processing" ? null : await repo.completePendingPublication(actor, id);
    const association = publication?.status === "published" && publication.kind === "personal" ? await repo.personalAssociation(actor, id) : null;
    return { ...video, ...(publication ? { publication: { ...publication, ...(association ? { association } : {}) } } : {}) };
  });
}

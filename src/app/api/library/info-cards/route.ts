import { infoRequest, infoQuery } from "@/lib/infoCards/http";
import { infoCatalogue } from "@/lib/infoCards/queries";
import { CREATOR_INFO_FILTER } from "@/lib/infoCards/model";
export async function GET(request: Request) {
  return infoRequest(request, async (repo, actor) => {
    const query = infoQuery(request);
    // The Info Card list resumes the owner's pending Creator publications before reading (checkpoint 10).
    const publications = query.offset ? [] : await repo.resumePendingPublications(actor, CREATOR_INFO_FILTER);
    return { ...await infoCatalogue(repo, actor, query), ...(publications.length ? { publications } : {}) };
  });
}

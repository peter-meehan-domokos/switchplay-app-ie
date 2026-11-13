import { fields } from "@/lib/cards/http";
import { infoRequest, infoQuery } from "@/lib/infoCards/http";

export async function GET(request: Request) {
  return infoRequest(request, async (repo, actor) => {
    const query = infoQuery(request);
    // My Drafts resumes the owner's pending Publish and Save requests before listing (checkpoint 10).
    const publications = query.offset ? [] : await repo.resumePendingPublications(actor);
    return { ...await repo.drafts(actor, query.offset, query.limit), ...(publications.length ? { publications } : {}) };
  });
}
export async function POST(request: Request) {
  return infoRequest(request, async (repo, actor) => {
    const body = await request.json(); fields(body, ["infoCardId"]);
    return repo.create(actor, body.infoCardId as string);
  });
}

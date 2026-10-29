import { fields } from "@/lib/cards/http";
import { infoRequest, infoQuery } from "@/lib/infoCards/http";

export async function GET(request: Request) {
  return infoRequest(request, (repo, actor) => { const query = infoQuery(request); return repo.drafts(actor, query.offset, query.limit); });
}
export async function POST(request: Request) {
  return infoRequest(request, async (repo, actor) => {
    const body = await request.json(); fields(body, ["infoCardId"]);
    return repo.create(actor, body.infoCardId as string);
  });
}

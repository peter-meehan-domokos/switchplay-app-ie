import { fields } from "@/lib/cards/http";
import { infoRequest, infoQuery } from "@/lib/infoCards/http";
import { discoverSeries } from "@/lib/infoCards/queries";
export async function GET(request: Request) { return infoRequest(request, (repo, actor) => discoverSeries(repo, actor, infoQuery(request))); }
export async function POST(request: Request) {
  return infoRequest(request, async (repo, actor) => {
    const body = await request.json(); fields(body, ["seriesId", "title"]);
    const series = await repo.createSeries(actor, body.seriesId as string, body.title);
    return { seriesId: series.seriesId, title: series.title, createdByUserId: series.createdByUserId };
  });
}

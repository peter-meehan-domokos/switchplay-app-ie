import { groupRequest, query } from "@/lib/groupExperiences/http";
export async function GET(request: Request) {
  return groupRequest(request, async (repo, actor) => { const params = query(request, ["after"]); return repo.collectionTiles(actor, params.get("after") ?? undefined); });
}

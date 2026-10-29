import { groupRequest, pagination, query } from "@/lib/groupExperiences/http";
export async function GET(request: Request) {
  return groupRequest(request, (repo, actor) => { const { after, limit } = pagination(query(request, ["after", "limit"])); return repo.list(actor, after, limit); });
}
export async function POST(request: Request) {
  return groupRequest(request, async (repo, actor) => { query(request, []); return repo.create(actor, await request.json()); });
}

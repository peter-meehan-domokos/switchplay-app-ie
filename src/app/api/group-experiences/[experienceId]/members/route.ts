import { groupRequest, pagination, query } from "@/lib/groupExperiences/http";
export async function GET(request: Request, context: { params: Promise<{ experienceId: string }> }) {
  return groupRequest(request, async (repo, actor) => { const { after, limit } = pagination(query(request, ["after", "limit"]));
    return repo.roster(actor, (await context.params).experienceId, after, limit); });
}
export async function POST(request: Request, context: { params: Promise<{ experienceId: string }> }) {
  return groupRequest(request, async (repo, actor) => { query(request, []); return repo.changeMember(actor, (await context.params).experienceId, await request.json()); });
}

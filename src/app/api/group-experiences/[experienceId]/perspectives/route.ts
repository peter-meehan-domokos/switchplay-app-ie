import { groupRequest, query, pagination } from "@/lib/groupExperiences/http";
export async function GET(request: Request, context: { params: Promise<{ experienceId: string }> }) {
  return groupRequest(request, async (repo, actor) => {
    const params = query(request, ["after", "limit", "cardOffset"]), { after, limit } = pagination(params);
    return repo.perspectivePage(actor, (await context.params).experienceId, after, limit, Number(params.get("cardOffset") ?? 0));
  });
}

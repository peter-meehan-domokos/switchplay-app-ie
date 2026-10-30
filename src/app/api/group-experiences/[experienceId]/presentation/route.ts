import { groupRequest, query } from "@/lib/groupExperiences/http";
export async function GET(request: Request, context: { params: Promise<{ experienceId: string }> }) {
  return groupRequest(request, async (repo, actor) => {
    const params = query(request, ["cardOffset"]);
    return repo.bootstrap(actor, (await context.params).experienceId, Number(params.get("cardOffset") ?? 0));
  });
}

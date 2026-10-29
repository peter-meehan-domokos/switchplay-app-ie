import { groupRequest, query } from "@/lib/groupExperiences/http";
import { requireCondition } from "@/lib/cards/domain";
export async function GET(request: Request, context: { params: Promise<{ experienceId: string }> }) {
  return groupRequest(request, async (repo, actor) => {
    const params = query(request, ["kind", "entityId", "perspective"]);
    requireCondition(params.get("perspective") === "group", "GROUP_UPDATE_PERSPECTIVE_FORBIDDEN");
    return repo.reviewUpdate(actor, (await context.params).experienceId, params.get("kind") as "card" | "deck", params.get("entityId") as string);
  });
}
export async function POST(request: Request, context: { params: Promise<{ experienceId: string }> }) {
  return groupRequest(request, async (repo, actor) => { query(request, []); return repo.adoptUpdate(actor, (await context.params).experienceId, await request.json()); });
}

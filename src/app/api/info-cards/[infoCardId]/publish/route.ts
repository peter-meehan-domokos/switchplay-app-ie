import { fields } from "@/lib/cards/http";
import { infoRequest } from "@/lib/infoCards/http";
export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ infoCardId: string }> }) {
  return infoRequest(request, async (repo, actor) => {
    const body = await request.json(); fields(body, ["revision"]);
    const result = await repo.publish(actor, (await context.params).infoCardId, body.revision as number);
    // Accepted, not yet published: the video is still processing and the request is stored (checkpoint 10).
    return "status" in result ? Response.json(result, { status: 202 }) : result;
  });
}

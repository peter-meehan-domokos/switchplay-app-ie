import { fields } from "@/lib/cards/http";
import { infoRequest } from "@/lib/infoCards/http";
export async function POST(request: Request, context: { params: Promise<{ infoCardId: string }> }) {
  return infoRequest(request, async (repo, actor) => {
    const body = await request.json(); fields(body, ["revision"]);
    return repo.publish(actor, (await context.params).infoCardId, body.revision as number);
  });
}

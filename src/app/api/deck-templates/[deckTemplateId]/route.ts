import { cardRequest } from "@/lib/cards/http";
import { creatorDTO } from "@/lib/cards/readModels";
export async function GET(_request: Request, context: RouteContext<'/api/deck-templates/[deckTemplateId]'>) {
  return cardRequest(async (repo, actor) => creatorDTO(repo, actor, (await context.params).deckTemplateId));
}
export function PATCH() { return Response.json({ error: "Legacy publication is disabled" }, { status: 410 }); }

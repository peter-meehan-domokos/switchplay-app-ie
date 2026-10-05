import { cardRequest, fields } from "@/lib/cards/http";
import { creatorDTO } from "@/lib/cards/readModels";
export async function POST(request: Request, context: RouteContext<'/api/deck-templates/[deckTemplateId]/move-step'>) {
  return cardRequest(async (repo, actor) => {
    const body = await request.json(); fields(body, ["sourceId", "destinationId", "sourceIndex", "destinationIndex", "revisions"]);
    const { deckTemplateId } = await context.params;
    await repo.moveConstructionStep(actor, deckTemplateId, body.sourceId as string, body.destinationId as string,
      body.sourceIndex as number, body.destinationIndex as number, body.revisions as { deck: number; source: number; destination: number });
    return creatorDTO(repo, actor, deckTemplateId);
  });
}

import { cardRequest, fields, jsonDTO } from "@/lib/cards/http";
import type { DeckContent } from "@/lib/cards/model";

export async function POST(request: Request, context: RouteContext<'/api/deck-templates/[deckTemplateId]/cards'>) {
  return cardRequest(async (repo, actor) => {
    const body = await request.json();
    fields(body, ["revision", "cardTemplateId", "stepIds", "content"]);
    const { deckTemplateId } = await context.params;
    return jsonDTO(await repo.createAndAttachCard(actor, {
      deckTemplateId,
      expectedDeckRevision: body.revision as number,
      cardTemplateId: body.cardTemplateId as string,
      stepIds: body.stepIds as string[],
      nextDeckContent: body.content as DeckContent,
    }));
  });
}

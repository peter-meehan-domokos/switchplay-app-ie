import { cardRequest } from "@/lib/cards/http";

export async function DELETE(_request: Request, context: RouteContext<'/api/cards-data/[cardTemplateId]/media/[mediaItemId]'>) {
  return cardRequest(async (repo, actor) => {
    const { cardTemplateId, mediaItemId } = await context.params;
    const mediaItems = await repo.removePersonalMedia(actor, cardTemplateId, mediaItemId);
    return { ok: true, cardId: cardTemplateId, mediaItems };
  });
}

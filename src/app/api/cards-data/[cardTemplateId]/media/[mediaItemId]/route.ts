import { personalUpdateRequest } from "@/lib/cards/http";

export async function DELETE(request: Request, context: RouteContext<'/api/cards-data/[cardTemplateId]/media/[mediaItemId]'>) {
  return personalUpdateRequest(request, async (repo, actor) => {
    const { cardTemplateId, mediaItemId } = await context.params;
    const mediaItems = await repo.removePersonalMedia(actor, cardTemplateId, mediaItemId);
    return { ok: true, cardId: cardTemplateId, mediaItems };
  });
}

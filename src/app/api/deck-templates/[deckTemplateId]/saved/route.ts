import { creatorRequestBoundary, fields } from "@/lib/cards/http";
import { creatorDTO } from "@/lib/cards/readModels";
import type { DeckContent, Visibility } from "@/lib/cards/model";
export async function PATCH(request: Request, context: RouteContext<'/api/deck-templates/[deckTemplateId]/saved'>) {
  return creatorRequestBoundary(request, async (repo, actor) => {
    const body = await request.json(); fields(body, ["revision", "content", "visibility"]);
    const { deckTemplateId } = await context.params;
    await repo.saveDeckDraft(actor, deckTemplateId, body.revision as number, body.content as DeckContent, body.visibility as Visibility | undefined);
    return creatorDTO(repo, actor, deckTemplateId);
  });
}

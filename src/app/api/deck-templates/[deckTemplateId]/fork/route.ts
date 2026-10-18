import { creatorRequestBoundary, fields, jsonDTO } from "@/lib/cards/http";
import type { DeckForkCommand } from "@/lib/cards/model";

export async function POST(request: Request, context: RouteContext<'/api/deck-templates/[deckTemplateId]/fork'>) {
  return creatorRequestBoundary(request, async (repo, actor) => {
    const body = await request.json(); fields(body, ["sourceVersion", "deckTemplateId", "content", "context", "cardFork", "visibility", "foreignCardSelections", "mediaProofs", "newCards"]);
    const { deckTemplateId } = await context.params;
    return jsonDTO(await repo.createDeckFork(actor, { ...body,
      source: { deckTemplateId, version: body.sourceVersion } } as DeckForkCommand));
  });
}

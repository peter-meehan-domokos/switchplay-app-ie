import { cardRequest, fields, jsonDTO } from "@/lib/cards/http";
import { creatorDTO } from "@/lib/cards/readModels";
import { requireCondition, isRecord } from "@/lib/cards/domain";
import type { DeckPublicationReview } from "@/lib/cards/model";
import { deckDraftContent } from "@/lib/cards/publicationRules";
export async function GET(request: Request, context: RouteContext<'/api/deck-templates/[deckTemplateId]/publish'>) {
  return cardRequest(async (repo, actor) => {
    const { deckTemplateId } = await context.params;
    const selected = new URL(request.url).searchParams.get("version");
    if (selected !== null) {
      const deck = await creatorDTO(repo, actor, deckTemplateId);
      const version = await repo.getDeckVersion(deckTemplateId, Number(selected));
      requireCondition(version && version.version <= deck.root.latestVersion, "MISSING_DECK_VERSION");
      return jsonDTO({ ...version, content: deckDraftContent(version.content) });
    }
    return repo.prepareDeckPublication(actor, deckTemplateId, Number(new URL(request.url).searchParams.get("revision")));
  });
}
export async function POST(request: Request, context: RouteContext<'/api/deck-templates/[deckTemplateId]/publish'>) {
  return cardRequest(async (repo, actor) => {
    const body = await request.json(); fields(body, ["revision", "updateNote", "review", "acceptCardDrafts"]);
    requireCondition(isRecord(body.review) && typeof body.acceptCardDrafts === "boolean", "INVALID_PUBLICATION_REVIEW");
    const { deckTemplateId } = await context.params;
    await repo.publishDeck(actor, deckTemplateId, body.revision as number, body.updateNote as string | undefined,
      { review: body.review as DeckPublicationReview, acceptCardDrafts: body.acceptCardDrafts as boolean });
    return creatorDTO(repo, actor, deckTemplateId);
  });
}

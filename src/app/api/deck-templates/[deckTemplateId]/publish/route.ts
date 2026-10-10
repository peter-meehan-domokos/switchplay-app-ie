import { creatorRequestBoundary, fields, jsonDTO } from "@/lib/cards/http";
import { creatorDTO } from "@/lib/cards/readModels";
import { requireCondition, isRecord } from "@/lib/cards/domain";
import type { DeckPublicationReview, ForkDeckEntry } from "@/lib/cards/model";
import { deckDraftContent } from "@/lib/cards/publicationRules";
export async function GET(request: Request, context: RouteContext<'/api/deck-templates/[deckTemplateId]/publish'>) {
  return creatorRequestBoundary(request, async (repo, actor) => {
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
  return creatorRequestBoundary(request, async (repo, actor) => {
    const body = await request.json(); fields(body, ["revision", "updateNote", "review", "acceptCardDrafts", "forkEntry"]);
    requireCondition(isRecord(body.review) && typeof body.acceptCardDrafts === "boolean", "INVALID_PUBLICATION_REVIEW");
    const { deckTemplateId } = await context.params;
    const fork = await repo.decks().findOne({ deckTemplateId, ownerUserId: actor }, { projection: { forkedFrom: 1 } });
    const version = await repo.publishDeck(actor, deckTemplateId, body.revision as number, body.updateNote as string | undefined,
      { review: body.review as DeckPublicationReview, acceptCardDrafts: body.acceptCardDrafts as boolean }, body.forkEntry as ForkDeckEntry | undefined);
    // Backend fork publication may retain foreign references. The Phase 2
    // Creator DTO deliberately rejects those until foreign editing is built.
    if (fork?.forkedFrom || body.forkEntry !== undefined) return { deckTemplateId, publishedVersion: version };
    return creatorDTO(repo, actor, deckTemplateId);
  });
}

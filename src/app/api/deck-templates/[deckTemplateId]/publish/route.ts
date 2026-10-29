import { creatorRequestBoundary, fields, jsonDTO } from "@/lib/cards/http";
import { creatorDTO } from "@/lib/cards/readModels";
import { creatorSessionDTO } from "@/lib/cards/creatorSession";
import { requireCondition, isRecord } from "@/lib/cards/domain";
import type { DeckPublicationReview, ForkDeckEntry } from "@/lib/cards/model";
import { deckDraftContent } from "@/lib/cards/publicationRules";
export async function GET(request: Request, context: RouteContext<'/api/deck-templates/[deckTemplateId]/publish'>) {
  return creatorRequestBoundary(request, async (repo, actor) => {
    const { deckTemplateId } = await context.params;
    const selected = new URL(request.url).searchParams.get("version");
    if (selected !== null) {
      const deck = await repo.decks().findOne({ deckTemplateId, ownerUserId: actor });
      requireCondition(deck, "DECK_FORBIDDEN");
      const version = await repo.getDeckVersion(deckTemplateId, Number(selected));
      requireCondition(version && version.version <= deck.latestVersion, "MISSING_DECK_VERSION");
      return jsonDTO({ ...version, content: deckDraftContent(version.content) });
    }
    return repo.prepareDeckPublication(actor, deckTemplateId, Number(new URL(request.url).searchParams.get("revision")));
  });
}
export async function POST(request: Request, context: RouteContext<'/api/deck-templates/[deckTemplateId]/publish'>) {
  return creatorRequestBoundary(request, async (repo, actor) => {
    const body = await request.json(); fields(body, ["revision", "updateNote", "review", "acceptCardDrafts", "acceptNewerForeignCards", "forkEntry"]);
    requireCondition(isRecord(body.review) && typeof body.acceptCardDrafts === "boolean", "INVALID_PUBLICATION_REVIEW");
    requireCondition(body.acceptNewerForeignCards === undefined || typeof body.acceptNewerForeignCards === "boolean", "INVALID_PUBLICATION_REVIEW");
    const { deckTemplateId } = await context.params;
    const fork = await repo.decks().findOne({ deckTemplateId, ownerUserId: actor }, { projection: { forkedFrom: 1 } });
    const version = await repo.publishDeck(actor, deckTemplateId, body.revision as number, body.updateNote as string | undefined,
      { review: body.review as DeckPublicationReview, acceptCardDrafts: body.acceptCardDrafts as boolean,
        ...(body.acceptNewerForeignCards !== undefined ? { acceptNewerForeignCards: body.acceptNewerForeignCards as boolean } : {}) }, body.forkEntry as ForkDeckEntry | undefined);
    if (new URL(request.url).searchParams.get("session") === "1") {
      const result = await creatorSessionDTO(repo, actor, deckTemplateId);
      requireCondition(result.deck.kind === "owned", "DECK_FORBIDDEN");
      return result.deck.owned;
    }
    // Preserve the existing compact domain receipt for non-session callers;
    // Creator sessions above use the mixed-ownership acknowledgement.
    if (fork?.forkedFrom || body.forkEntry !== undefined) return { deckTemplateId, publishedVersion: version };
    return creatorDTO(repo, actor, deckTemplateId);
  });
}

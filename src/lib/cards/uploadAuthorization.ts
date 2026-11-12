import type { CardRepository } from "./repository";
import { requireCondition, nonblank } from "./domain";
import { authorizeWorkingCard, resolveCreatorDeck, resolveCreatorCard } from "./resolvers";
import { fields } from "./http";
import { instructionalMedia } from "../stepMedia";

export async function authorizeUpload(repo: CardRepository, actor: string, body: unknown, extraFields: string[]) {
  fields(body, ["scope", "deckTemplateId", "cardTemplateId", ...extraFields]);
  requireCondition(nonblank(body.deckTemplateId), "INVALID_ENTITY_ID");
  const id = body.deckTemplateId;
  if (body.scope === "user-card") {
    requireCondition(nonblank(body.cardTemplateId), "INVALID_ENTITY_ID");
    const { card } = await authorizeWorkingCard(repo, actor, id, body.cardTemplateId);
    return { scope: "user-card" as const, deckTemplateId: id, cardTemplateId: body.cardTemplateId, media: card.data!.mediaItems };
  }
  if (body.scope === "card-template") {
    requireCondition(nonblank(body.cardTemplateId), "INVALID_ENTITY_ID");
    // Canonical Card ownership, independent of Deck ownership/placement. This
    // also preserves authorized in-flight work after a reference is detached.
    const card = await resolveCreatorCard(repo, actor, body.cardTemplateId);
    return { scope: "card-template" as const, deckTemplateId: id, cardTemplateId: body.cardTemplateId,
      media: [...instructionalMedia(card.content), card.content.mediaItem].filter(Boolean) };
  }
  const deck = await resolveCreatorDeck(repo, actor, id);
  if (body.scope === "deck-introduction") return { scope: "deck-introduction" as const, deckTemplateId: id,
    cardTemplateId: null, media: [deck.content.introduction?.video].filter(Boolean) };
  requireCondition(false, "INVALID_UPLOAD_SCOPE");
}

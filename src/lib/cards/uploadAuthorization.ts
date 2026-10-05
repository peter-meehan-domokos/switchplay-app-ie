import type { CardRepository } from "./repository";
import { requireCondition, nonblank } from "./domain";
import { authorizeWorkingCard, resolveCreatorDeck } from "./resolvers";
import { fields } from "./http";

export async function authorizeUpload(repo: CardRepository, actor: string, body: unknown, extraFields: string[]) {
  fields(body, ["scope", "deckTemplateId", "cardTemplateId", ...extraFields]);
  requireCondition(nonblank(body.deckTemplateId), "INVALID_ENTITY_ID");
  const id = body.deckTemplateId;
  if (body.scope === "user-card") {
    requireCondition(nonblank(body.cardTemplateId), "INVALID_ENTITY_ID");
    const { card } = await authorizeWorkingCard(repo, actor, id, body.cardTemplateId);
    return { scope: "user-card" as const, deckTemplateId: id, cardTemplateId: body.cardTemplateId, media: card.data!.mediaItems };
  }
  const deck = await resolveCreatorDeck(repo, actor, id);
  if (body.scope === "deck-introduction") return { scope: "deck-introduction" as const, deckTemplateId: id,
    cardTemplateId: null, media: [deck.content.introduction?.video].filter(Boolean) };
  requireCondition(body.scope === "card-template" && nonblank(body.cardTemplateId), "INVALID_UPLOAD_SCOPE");
  const card = deck.cards.find((card) => card.root.cardTemplateId === body.cardTemplateId);
  requireCondition(card?.root.ownerUserId === actor, "CARD_FORBIDDEN");
  return { scope: "card-template" as const, deckTemplateId: id, cardTemplateId: card.root.cardTemplateId,
    media: [card.content.intro.mediaItem, card.content.mediaItem, ...card.content.steps.map((step) => step.mediaItem)].filter(Boolean) };
}

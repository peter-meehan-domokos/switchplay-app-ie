import type { PreparedGroup } from "./preparation";
import { packPreparation, PREPARATION_PAGE_BYTES } from "./preparationPaging";
export function pagePreparedGroup(value: PreparedGroup, after?: string) {
  if (!after && Buffer.byteLength(JSON.stringify(value)) <= PREPARATION_PAGE_BYTES) return value;
  const { bootstrap, followers, aggregates, contributions } = value;
  const authority = { viewerUserId: value.viewerUserId, experienceId: value.experienceId, accessEpoch: value.accessEpoch, structureRevision: value.structureRevision, adoptionRevision: value.adoptionRevision };
  const context = [bootstrap.deck.cards.map(card => [card.id, card.version]), bootstrap.deck.version, bootstrap.selection, followers.map(row => [row.userId, row.username])];
  return packPreparation(authority, context, [{ index: 0, value: { bootstrap, followers, aggregates } },
    ...bootstrap.deck.cards.map((card, i) => ({ index: i + 1, value: { cardTemplateId: card.id, media: contributions.media[card.id], reflection: contributions.reflections[card.id] } }))], bootstrap.deck.cards.length + 1, after, bootstrap.selection);
}

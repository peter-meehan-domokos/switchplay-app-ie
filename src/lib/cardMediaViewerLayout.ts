import type { DeckLayout } from "@/components/decks/deckLayout";
import { visiblePersonalMedia } from "./cards/personalHistoryProjection";
import { resolveMediaSelection, type MediaSelection } from "./cardMediaViewer";

export type WorkingMediaSelection = MediaSelection & {
  cardId: string; activeCardId: string; focused: boolean;
  viewerUserId: string; deckTemplateId: string; version?: number;
};
// Derived selection never mutates the working Card/Deck layout or personal history.
export function buildCardMediaViewerLayout(deck: DeckLayout, selection: WorkingMediaSelection | null,
  context: { activeCardId: string; focused: boolean; transitioning: boolean }) {
  const card = selection ? deck.cards.find(card => card.id === selection.cardId) : undefined;
  const items = card ? visiblePersonalMedia(card) : [];
  const resolved = selection ? resolveMediaSelection(items, selection) : null;
  const valid = !!selection && !!resolved && !!deck.dataOwnerUserId && !context.transitioning
    && selection.viewerUserId === deck.dataOwnerUserId && selection.deckTemplateId === deck.deckTemplateId
    && selection.version === card?.adoptedVersion
    && selection.activeCardId === context.activeCardId && selection.focused === context.focused;
  return { items, resolved, valid };
}

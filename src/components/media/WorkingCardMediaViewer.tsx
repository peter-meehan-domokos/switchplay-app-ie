"use client";
import { useEffect, type RefObject } from "react";
import type { DeckLayout } from "@/components/decks/deckLayout";
import type { MediaOverlayContext } from "@/components/decks/DeckScene";
import { buildCardMediaViewerLayout, type WorkingMediaSelection } from "@/lib/cardMediaViewerLayout";
export type { WorkingMediaSelection } from "@/lib/cardMediaViewerLayout";
import { useMediaCollection } from "./useMediaCollection";
import { collectionDisplayItem } from "@/lib/mediaCollection/presentation";
import { normaliseCollectionSelectionKey } from "@/lib/mediaCollection/contracts";
import { personalMediaKey } from "@/lib/cards/personalHistoryProjection";
import CardMediaViewer from "./CardMediaViewer";

export default function WorkingCardMediaViewer({ deck, selection, context, sourceRef, onSelect, onClose }: {
  deck: DeckLayout; selection: WorkingMediaSelection | null; context: MediaOverlayContext;
  sourceRef: RefObject<HTMLButtonElement | null>;
  onSelect: (selection: WorkingMediaSelection) => void; onClose: () => void;
}) {
  const collectionContext = selection && deck.dataOwnerUserId ? { kind: "owner" as const, viewerUserId: deck.dataOwnerUserId, cardTemplateId: selection.cardId } : null;
  const collection = useMediaCollection(collectionContext);
  const override = collection.page && collectionContext ? collection.page.items.map(item => collectionDisplayItem(item, collectionContext)) : undefined;
  const { items, resolved, valid, validScope } = buildCardMediaViewerLayout(deck, selection && override ? { ...selection, mediaItemId: normaliseCollectionSelectionKey(selection.mediaItemId, selection.cardId) } : selection, context, override);
  useEffect(() => {
    if (selection && !validScope) onClose();
    else if ((collection.page || collection.error) && !collection.loading && selection && resolved && (selection.mediaItemId !== resolved.mediaItemId || selection.index !== resolved.index)) onSelect({ ...selection, ...resolved });
  }, [selection, validScope, resolved, onClose, onSelect, collection.loading, collection.page, collection.error]);
  if (!valid || !selection || !resolved) return null;
  return <CardMediaViewer key={`${deck.dataOwnerUserId}:${deck.deckTemplateId}:${selection.cardId}`} items={items} index={resolved.index}
    target={{ viewerUserId: deck.dataOwnerUserId!, cardTemplateId: selection.cardId, sourceCardTemplateId: selection.cardId }}
    collectionContext={collectionContext ?? undefined}
    paging={collection.page && collection.controller ? { older: Boolean(collection.page.older), newer: Boolean(collection.page.newer), loading: collection.loading,
      total: collection.page.total, start: collection.page.start ?? 0,
      navigate: direction => { const c = collection.controller!; c.select(selection.mediaItemId); void c.navigate(direction).then(() => {
        const current = c.selected(), page = c.snapshot().page;
        if (current && page) onSelect({ ...selection, mediaItemId: personalMediaKey(collectionDisplayItem(current, collectionContext!)), index: page.items.indexOf(current) });
      }); } } : undefined}
    sourceRef={sourceRef} backgroundRef={context.backgroundRef} onClose={onClose}
    onSelect={(mediaItemId, index) => onSelect({ ...selection, mediaItemId, index })} />;
}

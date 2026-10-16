"use client";
import { useEffect, type RefObject } from "react";
import type { DeckLayout } from "@/components/decks/deckLayout";
import type { MediaOverlayContext } from "@/components/decks/DeckScene";
import { buildCardMediaViewerLayout, type WorkingMediaSelection } from "@/lib/cardMediaViewerLayout";
export type { WorkingMediaSelection } from "@/lib/cardMediaViewerLayout";
import CardMediaViewer from "./CardMediaViewer";

export default function WorkingCardMediaViewer({ deck, selection, context, sourceRef, onSelect, onClose }: {
  deck: DeckLayout; selection: WorkingMediaSelection | null; context: MediaOverlayContext;
  sourceRef: RefObject<HTMLButtonElement | null>;
  onSelect: (selection: WorkingMediaSelection) => void; onClose: () => void;
}) {
  const { items, resolved, valid } = buildCardMediaViewerLayout(deck, selection, context);
  useEffect(() => {
    if (selection && !valid) onClose();
    else if (selection && resolved && (selection.mediaItemId !== resolved.mediaItemId || selection.index !== resolved.index)) onSelect({ ...selection, ...resolved });
  }, [selection, valid, resolved, onClose, onSelect]);
  if (!valid || !selection || !resolved) return null;
  return <CardMediaViewer key={`${deck.dataOwnerUserId}:${deck.deckTemplateId}:${selection.cardId}`} items={items} index={resolved.index}
    target={{ viewerUserId: deck.dataOwnerUserId!, cardTemplateId: selection.cardId, sourceCardTemplateId: selection.cardId }}
    sourceRef={sourceRef} backgroundRef={context.backgroundRef} onClose={onClose}
    onSelect={(mediaItemId, index) => onSelect({ ...selection, mediaItemId, index })} />;
}

import type { DeckLayout } from "@/components/decks/deckLayout";
import type { ImageMediaItem } from "@/lib/media";
import { isImageMediaItem } from "@/lib/media";

export function getDeckIntroductionPosterImage(deck: Pick<DeckLayout, "introduction">): ImageMediaItem | null {
  const introImage = deck.introduction?.image ?? null;

  return isImageMediaItem(introImage) ? introImage : null;
}
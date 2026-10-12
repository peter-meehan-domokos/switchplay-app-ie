import { hasPersonalDeck, type PresentedDeck } from "./presentation";
import { getPlayableDeckIntroductionVideo } from "./deckIntroPreview";
import { getDeckIntroductionPosterImage } from "./deckIntroductionPoster";
import { getCloudflareStreamThumbnailUrl } from "@/lib/cloudflareStreamPlayback";

type FrontContent = { id: string; title: string; category: string | null; ownerUsername: string; showOwnerTag: boolean;
  cardCount: number; cardIds: string[]; themes: { id: string; title: string }[]; posterSrc: string | null; hasIntroVideo: boolean };
export type DeckFrontPresentation = FrontContent & (
  { context: "personal"; completion: number | null; confidence: number | null }
  | { context: "canonical" }
);
export function deckFrontPresentation(deck: PresentedDeck): DeckFrontPresentation {
  const video = getPlayableDeckIntroductionVideo(deck);
  const content: FrontContent = { id: deck.id, title: deck.title, category: deck.category, ownerUsername: deck.ownerUsername,
    showOwnerTag: deck.showOwnerTag, cardCount: deck.cards.length, cardIds: deck.cards.slice(0, 3).map((card) => card.id),
    themes: (deck.streams ?? []).slice(0, 3).map(({ id, title }) => ({ id, title })),
    posterSrc: getDeckIntroductionPosterImage(deck)?.src ?? (video ? getCloudflareStreamThumbnailUrl(video) : null), hasIntroVideo: !!video };
  return hasPersonalDeck(deck) ? { ...content, context: "personal", completion: deck.progressPercentage, confidence: deck.confidenceScore }
    : { ...content, context: "canonical" };
}

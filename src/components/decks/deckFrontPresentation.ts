import { hasPersonalDeck, isExperienceDeck, type PresentedDeck } from "./presentation";
import { progressObservationState } from "@/lib/frameworks/progressState";
import { classifyProgress } from "@/lib/progress";
import { getPlayableDeckIntroductionVideo } from "./deckIntroPreview";
import { getDeckIntroductionPosterImage } from "./deckIntroductionPoster";
import { getCloudflareStreamThumbnailUrl } from "@/lib/cloudflareStreamPlayback";

type FrontContent = { id: string; title: string; category: string | null; ownerUsername: string; showOwnerTag: boolean;
  cardCount: number; cardIds: string[]; themes: { id: string; title: string }[]; posterSrc: string | null; hasIntroVideo: boolean };
export type DeckFrontPresentation = FrontContent & (
  { context: "personal" | "experience"; completion: number | null; confidence: number | null; isComplete: boolean; allSkipped?: boolean }
  | { context: "canonical" }
);
export function deckFrontPresentation(deck: PresentedDeck): DeckFrontPresentation {
  const video = getPlayableDeckIntroductionVideo(deck);
  const content: FrontContent = { id: deck.id, title: deck.title, category: deck.category, ownerUsername: deck.ownerUsername,
    showOwnerTag: deck.showOwnerTag, cardCount: isExperienceDeck(deck) ? deck.cardCount ?? deck.cards.length : deck.cards.length, cardIds: deck.cards.slice(0, 3).map((card) => card.id),
    themes: (deck.streams ?? []).slice(0, 3).map(({ id, title }) => ({ id, title })),
    posterSrc: getDeckIntroductionPosterImage(deck)?.src ?? (video ? getCloudflareStreamThumbnailUrl(video) : null), hasIntroVideo: !!video };
  if (isExperienceDeck(deck)) return { ...content, context: "experience", completion: deck.completion, confidence: deck.confidence,
    isComplete: deck.isComplete ?? classifyProgress(deck.cards.flatMap(card => card.steps)).isComplete,
    allSkipped: deck.allSkipped ?? (deck.cardCount === undefined || deck.cardCount === deck.cards.length ? progressObservationState(deck.cards.flatMap(card => card.steps)).state === "skipped" : false) };
  return hasPersonalDeck(deck) ? { ...content, context: "personal", completion: deck.progressPercentage, confidence: deck.confidenceScore,
    isComplete: classifyProgress(deck.cards.flatMap(card => card.steps)).isComplete, allSkipped: progressObservationState(deck.cards.flatMap(card => card.steps)).state === "skipped" }
    : { ...content, context: "canonical" };
}

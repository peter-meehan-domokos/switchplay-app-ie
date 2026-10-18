import type { CanonicalCardPresentation, CanonicalDeckPresentation } from "../../components/decks/presentation";
import type { DeckIntroduction } from "../../components/decks/types";
import { isImageMediaItem, isMediaItem, isVideoMediaItem, type MediaItem } from "../media";
import { assertAdoption, assertCardContent, assertDeckContent, requireCondition } from "./domain";
import type { CardTemplateVersion, DeckTemplateVersion } from "./model";
import { deckDraftContent } from "./publicationRules";

export type CreatorAttribution = { username: string; immediateSourceUsername: string | null };
export type LibraryCardPresentation = CanonicalCardPresentation & { creator: CreatorAttribution };
export type LibraryDeckPresentation = Omit<CanonicalDeckPresentation, "cards"> & { cards: LibraryCardPresentation[] };
// Immutable selections only. Authoring/recovery revisions never enter this token.
export type LibraryPreviewManifest = {
  deckTemplateId: string;
  deckVersion: number;
  cards: { cardTemplateId: string; version: number }[];
};
export type LibraryEntry = {
  availability: "available";
  deckTemplateId: string;
  publishedAt: string;
  deck: LibraryDeckPresentation;
  manifest: LibraryPreviewManifest;
} | {
  availability: "unavailable";
  deckTemplateId: string;
  title: "Unavailable Deck";
  publishedAt: string | null;
  // A safe category, never an inaccessible Card's identity/content or an exception.
  reason: "PUBLIC_CONTENT_UNAVAILABLE";
};

export function publicationTimestamp(value: unknown): string | null {
  return value instanceof Date && Number.isFinite(value.getTime()) ? value.toISOString() : null;
}

// Explicit nested allow-lists: media validators alone do not reject unknown keys.
export function canonicalMediaDTO(value: MediaItem | null | undefined): MediaItem | null {
  if (value == null) return null;
  requireCondition(isMediaItem(value), "INVALID_CANONICAL_MEDIA");
  const base = { id: value.id, description: value.description, mediaType: value.mediaType, src: value.src };
  if (value.mediaType === "image") {
    return "provider" in value && value.provider === "cloudflare-r2"
      ? { ...base, mediaType: "image", provider: "cloudflare-r2", assetId: value.assetId }
      : { ...base, mediaType: "image" };
  }
  return { ...base, mediaType: "video", provider: value.provider, assetId: value.assetId,
    ...(value.thumbnailSrc !== undefined ? { thumbnailSrc: value.thumbnailSrc } : {}),
    ...(value.provider === "cloudflare-stream" && value.width !== undefined ? { width: value.width } : {}),
    ...(value.provider === "cloudflare-stream" && value.height !== undefined ? { height: value.height } : {}),
  };
}

export function canonicalIntroductionDTO(value: DeckIntroduction | null): DeckIntroduction | null {
  if (value === null) return null;
  const image = canonicalMediaDTO(value.image), video = canonicalMediaDTO(value.video);
  requireCondition(image === null || isImageMediaItem(image), "INVALID_DECK_INTRODUCTION");
  requireCondition(video === null || isVideoMediaItem(video), "INVALID_DECK_INTRODUCTION");
  return { image, video };
}

export function libraryCardPresentation(version: CardTemplateVersion, label: string, creator: CreatorAttribution): LibraryCardPresentation {
  requireCondition(version.visibility === "public", "LIBRARY_CARD_FORBIDDEN");
  return cardContentPresentation(version, label, creator);
}

// Content-only selection visuals may also use an authorised personal adopted version.
// The caller must check access; public Library selection retains its stricter gate above.
export function cardContentPresentation(version: CardTemplateVersion, label: string, creator: CreatorAttribution): LibraryCardPresentation {
  assertAdoption(version.version); assertCardContent(version.content);
  const content = version.content;
  return { surface: "canonical", id: version.cardTemplateId, cardTemplateId: version.cardTemplateId,
    version: version.version, label, creator: { username: creator.username, immediateSourceUsername: creator.immediateSourceUsername },
    intro: { title: content.intro.title, description: content.intro.description, mediaItem: canonicalMediaDTO(content.intro.mediaItem) },
    steps: content.steps.map((step) => ({ stepId: step.stepId,
      ...(step.title !== undefined ? { title: step.title } : {}), description: step.description,
      ...(step.descriptionContent !== undefined ? { descriptionContent: step.descriptionContent.map((span) => span.type === "link"
        ? { type: "link" as const, text: span.text, url: span.url } : { type: "text" as const, text: span.text }) } : {}),
      mediaItem: canonicalMediaDTO(step.mediaItem),
    })),
  };
}

export function libraryDeckPresentation(version: DeckTemplateVersion, ownerUsername: string, cards: LibraryCardPresentation[]): LibraryDeckPresentation {
  requireCondition(version.visibility === "public", "LIBRARY_DECK_FORBIDDEN");
  assertAdoption(version.version); assertDeckContent(deckDraftContent(version.content));
  requireCondition(cards.length === version.content.cards.length && cards.every((card, index) => card.cardTemplateId === version.content.cards[index].cardTemplateId), "INVALID_CARD_REFERENCES");
  return { surface: "canonical", id: version.deckTemplateId, deckTemplateId: version.deckTemplateId,
    version: version.version, title: version.content.title, category: version.content.categories[0] ?? null,
    introduction: canonicalIntroductionDTO(version.content.introduction),
    streams: version.content.themes.map((theme) => ({ id: theme.id, title: theme.title })),
    ownerUsername, showOwnerTag: true, cards,
  };
}

export function previewManifest(deck: LibraryDeckPresentation): LibraryPreviewManifest {
  return { deckTemplateId: deck.deckTemplateId, deckVersion: deck.version,
    cards: deck.cards.map((card) => ({ cardTemplateId: card.cardTemplateId, version: card.version })) };
}

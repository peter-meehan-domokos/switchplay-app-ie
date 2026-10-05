import type { CardContent, DeckContent, PublishedDeckContent } from "./model";
import { DEFAULT_CREATOR_CARD_TITLE, DEFAULT_CREATOR_DECK_TITLE } from "./creatorDefaults";

// Canonical content contains plain objects/arrays. Key order is not a content change;
// array order and optional-field presence are significant, as in repository comparison.
export function sameContent(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (left === null || right === null || typeof left !== "object" || typeof right !== "object") return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length
      && left.every((value, index) => sameContent(value, right[index]));
  }
  const a = left as Record<string, unknown>, b = right as Record<string, unknown>;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => Object.hasOwn(b, key) && sameContent(a[key], b[key]));
}

export function deckDraftContent(published: PublishedDeckContent): DeckContent {
  return { ...published, cards: published.cards.map(({ cardTemplateId }) => ({ cardTemplateId })) };
}

export function cardPublicationIssue(latestVersion: number, draft: CardContent | null, published: CardContent | null): string | null {
  if (draft === null) return "NO_UNPUBLISHED_CHANGES";
  if (latestVersion === 0) {
    const title = draft.intro.title?.trim();
    return !title || title === DEFAULT_CREATOR_CARD_TITLE ? "CARD_FIRST_PUBLICATION_TITLE_REQUIRED" : null;
  }
  if (published === null) return "MISSING_CARD_VERSION";
  return sameContent(draft, published) ? "NO_UNPUBLISHED_CHANGES" : null;
}

export function deckPublicationIssue(latestVersion: number, draft: DeckContent | null, published: DeckContent | null,
  cards: readonly { cardTemplateId: string; latestVersion: number }[]): string | null {
  if (draft === null) return "NO_UNPUBLISHED_CHANGES";
  if (latestVersion === 0) {
    const title = draft.title.trim();
    if (!title || title === DEFAULT_CREATOR_DECK_TITLE) return "DECK_FIRST_PUBLICATION_TITLE_REQUIRED";
  } else {
    if (published === null) return "MISSING_DECK_VERSION";
    if (sameContent(draft, published)) return "NO_UNPUBLISHED_CHANGES";
  }
  const byId = new Map(cards.map((card) => [card.cardTemplateId, card]));
  for (const ref of draft.cards) {
    const card = byId.get(ref.cardTemplateId);
    if (!card) return "MISSING_CARD_REFERENCE";
    if (card.latestVersion < 1) return "UNPUBLISHED_CARDS_BLOCK_DECK";
  }
  return null;
}

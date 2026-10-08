import type { CardLayout } from "@/components/cards/cardLayout";
import type { DeckLayout } from "./deckLayout";
import type { CardIntro, CardTemplateStep, DeckCategory, DeckIntroduction, StreamTemplate } from "./types";
import type { ReactNode } from "react";

// Canonical inputs contain content and immutable selection only. They deliberately
// cannot satisfy a working Card/Deck interface by inventing personal state.
export type CanonicalCardPresentation = {
  surface: "canonical";
  id: string;
  cardTemplateId: string;
  version: number;
  label: string;
  intro: CardIntro;
  steps: CardTemplateStep[];
};
export type CanonicalDeckPresentation = {
  surface: "canonical";
  id: string;
  deckTemplateId: string;
  version: number;
  title: string;
  category: DeckCategory;
  introduction: DeckIntroduction | null;
  streams?: StreamTemplate[];
  ownerUsername: string;
  showOwnerTag: boolean;
  cards: CanonicalCardPresentation[];
};

// Existing working projections retain their calculations and personal history.
// The union makes the personal projection optional at the presentation boundary.
export type PresentedCard = CardLayout | CanonicalCardPresentation;
export type PresentedDeck = DeckLayout | CanonicalDeckPresentation;
export type CardBackPresentation = (card: PresentedCard, options: { dateLabel: string; variant: "preview" | "deck" }) => ReactNode;
export function hasPersonalCard(card: PresentedCard): card is CardLayout {
  return !("surface" in card);
}
export function hasPersonalDeck(deck: PresentedDeck): deck is DeckLayout {
  return !("surface" in deck);
}

export function cardPresentationIdentity(card: PresentedCard) {
  return hasPersonalCard(card) ? `working:${card.dataOwnerUserId ?? "readonly"}:${card.id}:${card.adoptedVersion ?? "unversioned"}`
    : `canonical:${card.id}:${card.version}`;
}

export function deckPresentationIdentity(deck: PresentedDeck) {
  return hasPersonalDeck(deck) ? `working:${deck.dataOwnerUserId ?? "readonly"}:${deck.id}:${deck.adoptedVersion ?? "unversioned"}`
    : `canonical:${deck.id}:${deck.version}`;
}

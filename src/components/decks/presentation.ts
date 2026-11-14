import type { CardLayout } from "@/components/cards/cardLayout";
import type { DeckLayout } from "./deckLayout";
import type { CardIntro, CardTemplateStep, DeckCategory, DeckIntroduction, StreamTemplate } from "./types";
import type { ReactNode } from "react";
import type { LearningFields } from "@/lib/cards/learning";
import type { CompletionStatus } from "./types";
import type { GroupAggregates } from "@/lib/groupExperiences/presentationReads";

export type ExperienceCardPresentation = Omit<CanonicalCardPresentation, "surface" | "steps"> & {
  surface: "experience"; experienceId: string; viewerUserId: string; dataIdentity: string;
  // The perspective this Card is presented in and the viewer access epoch, so Info Cards read and author in the
  // matching context (Me shows and creates the viewer own Follower contributions). Absent on Group tiles.
  perspective?: "group" | "self" | "follower"; accessEpoch?: number;
  // The follower inspected in the Other followers perspective, whose shared contributions the pouch reads, and
  // whether the Include Group content toggle adds the Group's Admin contributions (checkpoint 4.5c).
  subjectUserId?: string; includeGroupContent?: true;
  steps: (CardTemplateStep & { completionStatus: CompletionStatus })[];
  learning: LearningFields; canWriteLearning: boolean; ownerDate?: string | null;
  completion: number | null; confidence: number | null;
  aggregates?: GroupAggregates["cards"][number];
  aggregatePending?: { progress?: boolean; confidence?: boolean; progressSteps?: string[] };
};
export type ExperienceDeckPresentation = Omit<CanonicalDeckPresentation, "surface" | "cards"> & {
  surface: "experience"; experienceId: string; viewerUserId: string;
  cards: ExperienceCardPresentation[]; completion: number | null; confidence: number | null;
  cardCount?: number; isComplete?: boolean; allSkipped?: boolean;
};

// Canonical inputs contain content and immutable selection only. They deliberately
// cannot satisfy a working Card/Deck interface by inventing personal state.
export type CanonicalCardPresentation = {
  infoCardIds?: string[];
  infoCardAttachedAt?: Record<string, string>;
  surface: "canonical";
  creator?: { username: string; immediateSourceUsername: string | null };
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
export type PresentedCard = CardLayout | CanonicalCardPresentation | ExperienceCardPresentation;
export type PresentedDeck = DeckLayout | CanonicalDeckPresentation | ExperienceDeckPresentation;
export type CardBackPresentation = (card: PresentedCard, options: { dateLabel: string; variant: "preview" | "deck"; onOpenMedia?: import("@/lib/cardMediaViewer").OpenCardMedia }) => ReactNode;
export function hasPersonalCard(card: PresentedCard): card is CardLayout {
  return !("surface" in card);
}
export function hasPersonalDeck(deck: PresentedDeck): deck is DeckLayout {
  return !("surface" in deck);
}
export function isExperienceCard(card: PresentedCard): card is ExperienceCardPresentation { return "surface" in card && card.surface === "experience"; }
export function isExperienceDeck(deck: PresentedDeck): deck is ExperienceDeckPresentation { return "surface" in deck && deck.surface === "experience"; }

export function cardPresentationIdentity(card: PresentedCard) {
  // Physical identity is stable across perspectives. Data/security identity is
  // separate and includes subject/version: never use it to remount the scene,
  // and never use this layout ID as a cache key or authorisation grant.
  if (isExperienceCard(card)) return `experience:${card.viewerUserId}:${card.experienceId}:${card.id}`;
  return hasPersonalCard(card) ? `working:${card.dataOwnerUserId ?? "readonly"}:${card.id}:${card.adoptedVersion ?? "unversioned"}`
    : `canonical:${card.id}:${card.version}`;
}

export function deckPresentationIdentity(deck: PresentedDeck) {
  if (isExperienceDeck(deck)) return `experience:${deck.viewerUserId}:${deck.experienceId}`;
  return hasPersonalDeck(deck) ? `working:${deck.dataOwnerUserId ?? "readonly"}:${deck.id}:${deck.adoptedVersion ?? "unversioned"}`
    : `canonical:${deck.id}:${deck.version}`;
}

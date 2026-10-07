import type { ObjectId } from "mongodb";
import type { CompletionStatus, CardIntro, CardTemplateStep, DeckIntroduction, CardComment } from "../../components/decks/types";
import type { MediaItem } from "../media";

export type Visibility = "private" | "public";
export type AdoptedVersion = number; // Validated integer >= 1; personal data adopts immutable published content.
export type Step = CardTemplateStep; // Embedded content, never a separate business entity.
export type CardContent = { intro: CardIntro; suggestedTargetDate: string; steps: Step[]; mediaItem?: MediaItem | null };
export type DeckContent = {
  title: string;
  introduction: DeckIntroduction | null;
  categories: string[];
  themes: { id: string; title: string }[];
  cadence: { intervalDays: number }; // Weekly default; date generation stays position based.
  labelPrefix: string;
  cards: { cardTemplateId: string }[];
};
export type PublishedDeckContent = Omit<DeckContent, "cards"> & {
  cards: { cardTemplateId: string; cardVersionAtPublish: number }[];
};
export type CreateAndAttachCardCommand = {
  deckTemplateId: string;
  expectedDeckRevision: number;
  cardTemplateId: string;
  stepIds: string[];
  nextDeckContent: DeckContent;
};
type Root<C, F> = {
  ownerUserId: string;
  visibility: Visibility;
  latestVersion: number;
  draft: C | null;
  revision: number;
  forkedFrom: F | null;
  createdAt: Date;
  updatedAt: Date;
};
export type CardTemplateRoot = Root<CardContent, { cardTemplateId: string; version: number }> & {
  cardTemplateId: string;
  stepIds: string[]; // Technical uniqueness reservation, including published history.
};
export type DeckTemplateRoot = Root<DeckContent, { deckTemplateId: string; version: number }> & { deckTemplateId: string };
type Version<C> = { version: number; content: C; updateNote?: string; publishedAt: Date; publishedByUserId: string };
export type CardTemplateVersion = Version<CardContent> & { cardTemplateId: string };
export type DeckTemplateVersion = Version<PublishedDeckContent> & { deckTemplateId: string };
export type CardTest = { id: string; date: string; result: boolean; createdAt: Date };
export type CardData = {
  cardTemplateId: string;
  cardTemplateVersion: AdoptedVersion;
  targetDate: string | null;
  items: { stepId: string; completionStatus: CompletionStatus }[];
  signalReadings: { stepId: string; reading: number | null }[];
  reflection: string;
  mediaItems: MediaItem[];
  chats: { id: string; deckTemplateId: string; comments: CardComment[] }[];
  tests: CardTest[];
  createdAt: Date;
  updatedAt: Date;
};
export type DeckData = {
  deckTemplateId: string;
  deckTemplateVersion: AdoptedVersion;
  activeCardId: string | null;
  archivedAt: Date | null;
  sharedWithUserIds: unknown; // Parked raw metadata; ordinary writes never normalize it.
  createdAt: Date;
  updatedAt: Date;
  openedAt: Date | null;
  cadenceAnchorDate: string | null; // Filled once, on the first successful working open.
};
export type PersonalUser = { _id: ObjectId | string; decksData: DeckData[]; cardsData: CardData[] };
export type Capabilities = {
  templateOwnerUserId: string; dataOwnerUserId: string;
  canEditDeck: boolean; canPublishDeck: boolean; canArchiveDeck: boolean;
  canEditCard: boolean; canPublishCard: boolean; canForkCard: boolean;
  canMutateCardData: boolean; canUpdateCard: boolean;
};
// Ephemeral publication consent, never persisted. Ordered references and Card
// revisions pin both the published versions and the draft state reviewed by UI.
export type DeckPublicationReview = {
  deckTemplateId: string;
  revision: number;
  cards: { cardTemplateId: string; revision: number; latestVersion: number; hasDraft: boolean }[];
};

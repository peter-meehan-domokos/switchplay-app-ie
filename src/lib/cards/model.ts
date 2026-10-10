import type { ObjectId } from "mongodb";
import type { CompletionStatus, CardIntro, CardTemplateStep, DeckIntroduction, CardComment } from "../../components/decks/types";
import type { MediaItem } from "../media";

export type Visibility = "private" | "public";
export type AdoptedVersion = number; // Validated integer >= 1; personal data adopts immutable published content.
export type Step = CardTemplateStep; // Embedded content, never a separate business entity.
export type ForkContext = { kind: "library" } | { kind: "my-decks"; deckTemplateId: string };
export type CardForkSource = { cardTemplateId: string; version: number };
export type DeckForkSource = { deckTemplateId: string; version: number };
export type CardForkCommand = {
  source: CardForkSource; cardTemplateId: string; stepIds: string[];
  content: CardContent; context: ForkContext; visibility?: Visibility; mediaProofs?: string[];
  attachTo?: { deckTemplateId: string; revision: number; nextDeckContent: DeckContent };
};
export type DeckForkCommand = {
  source: DeckForkSource; deckTemplateId: string; content: DeckContent; context: ForkContext;
  newCards?: { cardTemplateId: string; content: CardContent }[]; cardFork?: CardForkCommand; visibility?: Visibility; foreignCardSelections?: CardForkSource[]; mediaProofs?: string[];
};
export type ForkDeckEntry = { enterMyDecks: boolean };
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
  // Effective access belongs to published content; this is next-publication intent.
  draftVisibility?: Visibility;
  latestVersion: number;
  draft: C | null;
  revision: number;
  forkedFrom: F | null;
  // Origin survives draft reopening and controls Deck-level continuity at first
  // publication. Card personal inheritance is viewer-owned and origin-independent.
  forkContext?: ForkContext;
  createdAt: Date;
  updatedAt: Date;
};
export type CardTemplateRoot = Root<CardContent, { cardTemplateId: string; version: number }> & {
  cardTemplateId: string;
  stepIds: string[]; // Technical uniqueness reservation, including published history.
  firstReusedAt?: Date; // Permanent end of exclusive construction; removal never clears it.
  referenceRevision?: number; // Transaction lock for reference changes, independent of content autosave revisions.
};
export type DeckTemplateRoot = Root<DeckContent, { deckTemplateId: string; version: number }> & {
  deckTemplateId: string;
  foreignCardSelections?: CardForkSource[]; // Private authoring selections; never personal adoption or published content.
  publicationGuard?: number; // Transaction serialization only; never an authoring revision.
};
type Version<C> = { version: number; content: C; visibility?: Visibility; updateNote?: string; publishedAt: Date; publishedByUserId: string };
export type ForkPublicationReceipt = {
  revision: number; enterMyDecks?: boolean;
  review?: DeckPublicationReview; acceptCardDrafts?: boolean;
};
export type CardTemplateVersion = Version<CardContent> & { cardTemplateId: string; forkPublicationReceipt?: ForkPublicationReceipt };
// Immutable receipt for Copy auto-publication recovery. Draft-only Copy keeps
// its existing exact-append recovery; no workflow flags or receipt collection.
export type CopyPublicationReceipt = { cardTemplateId: string; revision: number; contentHash: string };
export type DeckTemplateVersion = Version<PublishedDeckContent> & { deckTemplateId: string; copyReceipt?: CopyPublicationReceipt; forkPublicationReceipt?: ForkPublicationReceipt };
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
  historySourceCardTemplateId?: string; // Actor's immediate source record, never copied events.
  createdAt: Date;
  updatedAt: Date;
};
export type DeckData = {
  membershipRevision?: number; // Archive/Restore precondition; absent legacy values mean zero.
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

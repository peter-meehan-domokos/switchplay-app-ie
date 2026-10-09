import type { ImageMediaItem, MediaItem, VideoMediaItem } from "@/lib/media";

export type DeckCategory = string | null;
export type CompletionStatus = "todo" | "inProgress" | "done" | "skipped";
export type SignalOrder = "increasing" | "decreasing";

export type CardComment = {
  id: string;
  creatorId: string;
  createdAt: string;
  text: string;
  isRetained: boolean;
};

export type CardChat = {
  id: string;
  deckTemplateId?: string;
  comments: CardComment[];
};

export type CardIntro = {
  title: string | null;
  description: string | null;
  mediaItem: MediaItem | null;
};

export type CardTemplateStep = {
  stepId: string;
  forkedFrom?: { cardTemplateId: string; version: number; stepId: string };
  title?: string;
  description: string | null;
  descriptionContent?: StepDescriptionSpan[];
  mediaItem?: MediaItem | null;
};

export type StepDescriptionSpan =
  | { type: "text"; text: string }
  | { type: "link"; text: string; url: string };

export type CardTemplateSignal = {
  signalId: string;
  title: string | null;
  order: SignalOrder | null;
  minValue: number | null;
  maxValue: number | null;
  isTheoreticalMin?: boolean;
  isTheoreticalMax?: boolean;
  unit: string | null;
};

export type CardTemplate = {
  cardId: string;
  label: string;
  suggestedTargetDate: string;
  intro: CardIntro;
  steps: CardTemplateStep[];
  signals?: CardTemplateSignal[];
};

export type StreamTemplate = {
  id: string;
  title: string;
};

export type DeckIntroduction = {
  image: ImageMediaItem | null;
  video: VideoMediaItem | null;
};

export type DeckTemplate = {
  deckTemplateId: string;
  title: string;
  category: DeckCategory;
  introduction?: DeckIntroduction | null;
  streams: StreamTemplate[];
  cards: CardTemplate[];
};

export type RuntimeDeckTemplate = Omit<DeckTemplate, "introduction"> & {
  introduction: DeckIntroduction | null;
};

export type UserCardItemData = {
  itemId: string;
  completionStatus: string;
};

export type UserCardSignalReading = {
  signalId: string;
  reading: number | null;
};

export type UserCardData = {
  cardId: string;
  targetDate: string;
  items: UserCardItemData[];
  signalReadings: UserCardSignalReading[];
  reflection: string;
  mediaItems: MediaItem[];
  chats: CardChat[];
};

export type UserDeckData = {
  deckTemplateId: string;
  activeCardId: string;
  cards: UserCardData[];
  sharedWithUserIds: string[];
  createdAt: string;
  updatedAt: string;
  openedAt?: string | null;
};

export type ClientUserCardStepData = {
  stepId: string;
  completionStatus: string;
};

export type ClientUserCardData = {
  cardId: string;
  targetDate: string;
  steps: ClientUserCardStepData[];
  signalReadings: UserCardSignalReading[];
  reflection: string;
  mediaItems: MediaItem[];
  chats: CardChat[];
};

export type ClientUserDeckData = {
  deckTemplateId: string;
  activeCardId: string;
  cards: ClientUserCardData[];
  sharedWithUserIds: string[];
  createdAt: string;
  updatedAt: string;
  openedAt?: string | null;
};

export type WeeklyCardStep = {
  stepId: string;
  title?: string;
  description: string | null;
  descriptionContent?: StepDescriptionSpan[];
  completionStatus: string;
  mediaItem?: MediaItem | null;
};

export type WeeklyCardSignal = {
  id: string;
  title: string;
  order: SignalOrder | null;
  reading: number | null;
  rawReading: number | null;
  unit: string | null;
};

export type WeeklyCard = {
  creator?: { username: string; immediateSourceUsername: string | null };
  // Viewer-owned history. Events retain their original Card/Deck context;
  // adoption is explicitly not an event-time version attribution.
  personalHistory?: {
    cardTemplateId: string;
    currentAdoptedCardTemplateVersion: number | null; // Unknown for corrupt historical metadata, never event-time attribution.
    eventVersionAttribution: "not-recorded";
    tests: { id: string; date: string; result: boolean; createdAt: string }[];
    chats: CardChat[];
    mediaItems: MediaItem[];
  }[];
  cardTemplateId?: string;
  adoptedVersion?: number;
  templateOwnerUserId?: string;
  dataOwnerUserId?: string;
  permissions?: import("@/lib/cards/model").Capabilities;
  id: string;
  label: string;
  targetDate: string;
  intro: CardIntro;
  steps: WeeklyCardStep[];
  signals: WeeklyCardSignal[];
  mediaItems: MediaItem[];
  chats: CardChat[];
  reflection: string;
};

export type Deck = {
  templateOwnerUserId?: string;
  dataOwnerUserId?: string;
  context?: "working";
  adoptedVersion?: number;
  permissions?: import("@/lib/cards/model").Capabilities;
  id: string;
  deckTemplateId: string;
  hasUserDeckData: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  openedAt?: string | null;
  canMutate: boolean;
  isOwnedByCurrentUser: boolean;
  ownerUserId: string;
  ownerUsername: string;
  showOwnerTag: boolean;
  activeCardId: string;
  title: string;
  category: DeckCategory;
  introduction: DeckIntroduction | null;
  streams?: StreamTemplate[];
  cards: WeeklyCard[];
};

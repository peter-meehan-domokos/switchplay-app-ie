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
  comments: CardComment[];
};

export type CardIntro = {
  title: string | null;
  description: string | null;
  mediaItem: MediaItem | null;
};

export type CardTemplateStep = {
  stepId: string;
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
  reading: number;
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
};

export type WeeklyCardStep = {
  stepId: string;
  description: string | null;
  descriptionContent?: StepDescriptionSpan[];
  completionStatus: string;
  mediaItem?: MediaItem | null;
};

export type WeeklyCardSignal = {
  id: string;
  streamTitle: string;
  order: SignalOrder | null;
  reading: number;
  unit: string | null;
};

export type WeeklyCard = {
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
  id: string;
  deckTemplateId: string;
  hasUserDeckData: boolean;
  canMutate: boolean;
  isOwnedByCurrentUser: boolean;
  ownerUserId: string;
  ownerUsername: string;
  showOwnerTag: boolean;
  activeCardId: string;
  title: string;
  category: DeckCategory;
  streams?: StreamTemplate[];
  cards: WeeklyCard[];
};

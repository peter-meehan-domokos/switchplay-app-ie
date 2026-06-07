import type { MediaItem } from "@/lib/media";

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
  description: string;
  mediaItem: MediaItem | null;
};

export type CardTemplateStep = {
  stepId: string;
  description: string;
  mediaItem?: MediaItem;
};

export type CardTemplateSignal = {
  signalId: string;
  title: string;
  order: SignalOrder;
  minValue: number;
  maxValue: number;
  isTheoreticalMin?: boolean;
  isTheoreticalMax?: boolean;
  unit: string | null;
};

export type CardTemplate = {
  cardId: string;
  title: string;
  subtitle: string;
  suggestedTargetDate: string;
  intro: CardIntro;
  steps: CardTemplateStep[];
  signals: CardTemplateSignal[];
};

export type ChannelTemplate = {
  id: string;
  title: string;
};

export type DeckTemplate = {
  deckTemplateId: string;
  title: string;
  category: DeckCategory;
  channels: ChannelTemplate[];
  cards: CardTemplate[];
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
  channels?: ChannelTemplate[];
  cards: UserCardData[];
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
  channels?: ChannelTemplate[];
  cards: ClientUserCardData[];
  createdAt: string;
  updatedAt: string;
};

export type WeeklyCardStep = {
  stepId: string;
  description: string;
  completionStatus: string;
  mediaItem?: MediaItem;
};

export type WeeklyCardSignal = {
  id: string;
  title: string;
  order: SignalOrder;
  reading: number;
  minValue: number;
  maxValue: number;
  isTheoreticalMin?: boolean;
  isTheoreticalMax?: boolean;
  unit: string | null;
};

export type WeeklyCard = {
  id: string;
  title: string;
  subtitle: string;
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
  activeCardId: string;
  title: string;
  category: DeckCategory;
  channels?: ChannelTemplate[];
  cards: WeeklyCard[];
};

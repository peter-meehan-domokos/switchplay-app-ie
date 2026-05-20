import type { WeeklyCard } from "@/components/decks/types";
import type { PulseFieldSignalVariant } from "@/components/decks/PulseFieldSignal";
import type { MediaItem } from "@/lib/media";

export type SignalDimension = "recovery" | "stability" | "adaptation" | "execution" | "reflection" | "connection";
export type SignalOrder = "increasing" | "decreasing";
export type SignalVariant = PulseFieldSignalVariant;

type RawCardStat = NonNullable<WeeklyCard["stats"]>[number];
type RawCardComment = NonNullable<WeeklyCard["chats"]>[number]["comments"][number];

export type LayoutUser = {
  id: string;
  name: string;
};

export type CardLayoutOptions = {
  currentUserId: string;
  users: LayoutUser[];
};

export type CardLayoutExternalComment = {
  id: string;
  text: string;
  author: string;
};

export type CardLayoutSignal = {
  id: string;
  title: string;
  description: string;
  value: number;
  reading: number;
  variant: SignalVariant;
  targetValue: number;
  minValue: number;
  maxValue: number;
  unit: string;
  order: SignalOrder;
  dimension: SignalDimension;
};

export type CardLayout = WeeklyCard & {
  backMediaTrace: MediaItem | null;
  externalComment: CardLayoutExternalComment | null;
  signals: CardLayoutSignal[];
};

const signalVariants: SignalVariant[] = ["recovery", "movement", "load"];

function clampSignalValue(value: number) {
  return Math.min(Math.max(value, 0), 1);
}

function normalizeSignalOrder(order: string): SignalOrder {
  return order === "decreasing" ? "decreasing" : "increasing";
}

function normalizeSignalDimension(dimension: string): SignalDimension {
  if (
    dimension === "recovery" ||
    dimension === "stability" ||
    dimension === "adaptation" ||
    dimension === "reflection" ||
    dimension === "connection"
  ) {
    return dimension;
  }

  return "execution";
}

export function getNormalizedSignalValue(reading: number, minValue: number, maxValue: number, order: SignalOrder) {
  const range = maxValue - minValue;

  if (!Number.isFinite(reading) || !Number.isFinite(range) || range === 0) {
    return 0.5;
  }

  const normalizedValue = (reading - minValue) / range;
  return clampSignalValue(order === "decreasing" ? 1 - normalizedValue : normalizedValue);
}

function normalizeStatToSignal(stat: RawCardStat, index: number): CardLayoutSignal {
  const order = normalizeSignalOrder(stat.order);
  const minValue = Number.isFinite(stat.minValue) ? stat.minValue : 0;
  const maxValue = Number.isFinite(stat.maxValue) ? stat.maxValue : minValue + 1;
  const reading = Number.isFinite(stat.reading) ? stat.reading : minValue;

  return {
    id: stat.id,
    title: stat.title,
    description: stat.description,
    value: getNormalizedSignalValue(reading, minValue, maxValue, order),
    reading,
    variant: signalVariants[index] ?? "movement",
    targetValue: stat.targetValue,
    minValue,
    maxValue,
    unit: stat.unit,
    order,
    dimension: normalizeSignalDimension(stat.dimension),
  };
}

function normalizeMediaItem(mediaItem: WeeklyCard["mediaItems"][number] | undefined): MediaItem | null {
  if (!mediaItem) {
    return null;
  }

  return {
    id: mediaItem.id,
    mediaType: mediaItem.mediaType === "video" ? "video" : "image",
    description: mediaItem.description,
    src: mediaItem.src,
  };
}

function getExternalCommentAuthor(comment: RawCardComment, users: LayoutUser[]) {
  return users.find((user) => user.id === comment.creatorId)?.name ?? "Unknown";
}

function normalizeExternalComment(card: WeeklyCard, options: CardLayoutOptions): CardLayoutExternalComment | null {
  const retainedExternalComment = card.chats
    .flatMap((chat) => chat.comments)
    .find((comment) => comment.creatorId !== options.currentUserId && comment.isRetained === true);

  if (!retainedExternalComment) {
    return null;
  }

  return {
    id: retainedExternalComment.id,
    text: retainedExternalComment.text,
    author: getExternalCommentAuthor(retainedExternalComment, options.users),
  };
}

export function buildCardLayout(card: WeeklyCard, options: CardLayoutOptions): CardLayout {
  return {
    ...card,
    backMediaTrace: normalizeMediaItem(card.mediaItems[0]),
    externalComment: normalizeExternalComment(card, options),
    signals: card.stats.map(normalizeStatToSignal),
  };
}

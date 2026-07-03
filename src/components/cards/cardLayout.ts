import type { WeeklyCard } from "@/components/decks/types";
import type { PulseFieldSignalVariant } from "@/components/decks/PulseFieldSignal";
import type { MediaItem } from "@/lib/media";
import { isImageMediaItem, isLegacyProviderlessVideoMediaItem, isVideoMediaItem } from "@/lib/media";
import { getProgressPercentage } from "@/lib/progress";
import { clampSignalReading, roundSignalReadingForDisplay, signalReadingToNormalized } from "@/lib/signals";

export type SignalOrder = "increasing" | "decreasing";
export type SignalVariant = PulseFieldSignalVariant;

type RawCardSignal = NonNullable<WeeklyCard["signals"]>[number];
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
  streamTitle: string;
  value: number;
  reading: number;
  variant: SignalVariant;
  unit: string | null;
  order: SignalOrder;
};

export type CardLayout = Omit<WeeklyCard, "signals"> & {
  backMediaTrace: MediaItem | null;
  externalComment: CardLayoutExternalComment | null;
  ecologicalOccupancy: number;
  ecologicalOccupancyRatio: number;
  progressPercentage: number;
  reflectionVerticalOffset: number;
  signals: CardLayoutSignal[];
};

const signalVariants: SignalVariant[] = ["recovery", "movement", "load"];
const sparseReflectionOffset = -10;

export function snapReadingToInteger(reading: number) {
  return roundSignalReadingForDisplay(reading);
}

function normalizeSignal(signal: RawCardSignal, index: number): CardLayoutSignal {
  const order = "increasing";

  // Keep reading precision for field position continuity; display rounding stays in UI.
  const reading = clampSignalReading(signal.reading);

  return {
    id: signal.id,
    streamTitle: signal.streamTitle,
    value: signalReadingToNormalized(reading),
    reading,
    variant: signalVariants[index] ?? "movement",
    unit: signal.unit,
    order,
  };
}

function normalizeMediaItem(mediaItem: WeeklyCard["mediaItems"][number] | undefined): MediaItem | null {
  if (!mediaItem) {
    return null;
  }

  if (isImageMediaItem(mediaItem) || isVideoMediaItem(mediaItem)) {
    return mediaItem;
  }

  if (isLegacyProviderlessVideoMediaItem(mediaItem)) {
    return null;
  }

  return null;
}

function getExternalCommentAuthor(comment: RawCardComment, users: LayoutUser[]) {
  return users.find((user) => user.id === comment.creatorId)?.name ?? "Unknown";
}

function normalizeExternalComment(card: WeeklyCard, options: CardLayoutOptions): CardLayoutExternalComment | null {
  const retainedExternalComment = card.chats
    .flatMap((chat) => chat.comments)
    .filter((comment) => comment.isRetained === true)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )[0];

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
  const backMediaTrace = normalizeMediaItem(card.mediaItems[0]);
  const externalComment = normalizeExternalComment(card, options);
  const hasReflection = Boolean(card.reflection);
  const progressPercentage = getProgressPercentage(
    card.steps.map((step) => ({ completionStatus: step.completionStatus })),
  );
  const ecologicalOccupancy =
    Number(Boolean(backMediaTrace)) +
    Number(Boolean(externalComment)) +
    Number(hasReflection);
  const ecologicalOccupancyRatio = ecologicalOccupancy / 3;
  const reflectionVerticalOffset = backMediaTrace ? 0 : sparseReflectionOffset;

  return {
    ...card,
    backMediaTrace,
    externalComment,
    ecologicalOccupancy,
    ecologicalOccupancyRatio,
    progressPercentage,
    reflectionVerticalOffset,
    signals: card.signals.map(normalizeSignal),
  };
}

export function withDerivedCardProgress(card: CardLayout): CardLayout {
  return {
    ...card,
    progressPercentage: getProgressPercentage(
      card.steps.map((step) => ({ completionStatus: step.completionStatus })),
    ),
  };
}

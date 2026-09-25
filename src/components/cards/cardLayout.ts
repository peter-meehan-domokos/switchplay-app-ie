import type { WeeklyCard } from "@/components/decks/types";
import type { PulseFieldSignalVariant } from "@/components/decks/PulseFieldSignal";
import type { MediaItem } from "@/lib/media";
import { getProgressPercentage } from "@/lib/progress";
import { clampSignalReading, roundSignalReadingForDisplay, signalReadingToNormalized } from "@/lib/signals";
import { selectAllVisibleUserCardMediaItems, type ModernUserCardMediaItem } from "@/lib/userCardMedia";

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
  title: string;
  value: number;
  reading: number;
  variant: SignalVariant;
  unit: string | null;
  order: SignalOrder;
};

export type CardLayout = Omit<WeeklyCard, "signals"> & {
  backMediaItems: ModernUserCardMediaItem[];
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
    title: signal.title,
    value: signalReadingToNormalized(reading),
    reading,
    variant: signalVariants[index] ?? "movement",
    unit: signal.unit,
    order,
  };
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
  const backMediaItems = selectAllVisibleUserCardMediaItems(card.mediaItems);
  const externalComment = normalizeExternalComment(card, options);
  const hasReflection = Boolean(card.reflection);
  const progressPercentage = getProgressPercentage(
    card.steps.map((step) => ({ completionStatus: step.completionStatus })),
  );
  const ecologicalOccupancy =
    Number(backMediaItems.length > 0) +
    Number(Boolean(externalComment)) +
    Number(hasReflection);
  const ecologicalOccupancyRatio = ecologicalOccupancy / 3;
  const reflectionVerticalOffset = backMediaItems.length > 0 ? 0 : sparseReflectionOffset;

  return {
    ...card,
    backMediaItems,
    externalComment,
    ecologicalOccupancy,
    ecologicalOccupancyRatio,
    progressPercentage,
    reflectionVerticalOffset,
    signals: card.signals.map(normalizeSignal),
  };
}

export function withCardMediaItems(card: CardLayout, mediaItems: MediaItem[]): CardLayout {
  const backMediaItems = selectAllVisibleUserCardMediaItems(mediaItems);
  const hasBackMedia = backMediaItems.length > 0;
  const ecologicalOccupancy =
    Number(hasBackMedia) +
    Number(Boolean(card.externalComment)) +
    Number(Boolean(card.reflection));

  return {
    ...card,
    mediaItems,
    backMediaItems,
    ecologicalOccupancy,
    ecologicalOccupancyRatio: ecologicalOccupancy / 3,
    reflectionVerticalOffset: hasBackMedia ? 0 : sparseReflectionOffset,
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

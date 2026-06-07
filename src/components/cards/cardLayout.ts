import type { WeeklyCard } from "@/components/decks/types";
import type { PulseFieldSignalVariant } from "@/components/decks/PulseFieldSignal";
import type { MediaItem } from "@/lib/media";
import { getProgressPercentage } from "@/lib/progress";

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
  minValue: number;
  maxValue: number;
  isTheoreticalMin?: boolean;
  isTheoreticalMax?: boolean;
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

function clampSignalValue(value: number) {
  return Math.min(Math.max(value, 0), 1);
}

// MVP integer-mode rendering.
// Future signal precision support may preserve decimal min/max values
// while rounding displayed/persisted readings independently.

function normalizeSignalRange(minValue: number, maxValue: number) {
  const safeMinValue = Number.isFinite(minValue) ? minValue : 0;
  const safeMaxValue = Number.isFinite(maxValue) ? maxValue : safeMinValue + 1;
  const lowerBound = Math.min(safeMinValue, safeMaxValue);
  const upperBound = Math.max(safeMinValue, safeMaxValue);

  if (lowerBound === upperBound) {
    return {
      minValue: lowerBound,
      maxValue: lowerBound + 1,
    };
  }

  return {
    minValue: lowerBound,
    maxValue: upperBound,
  };
}

export function clampReadingToSignalRange(reading: number, minValue: number, maxValue: number) {
  const { minValue: lowerBound, maxValue: upperBound } = normalizeSignalRange(minValue, maxValue);

  if (!Number.isFinite(reading)) {
    return lowerBound;
  }

  return Math.min(Math.max(reading, lowerBound), upperBound);
}

export function snapReadingToInteger(reading: number) {
  return Number.isFinite(reading) ? Math.round(reading) : 0;
}

export function readingToNormalized(reading: number, minValue: number, maxValue: number, order: SignalOrder) {
  const { minValue: lowerBound, maxValue: upperBound } = normalizeSignalRange(minValue, maxValue);
  const clampedReading = clampReadingToSignalRange(reading, lowerBound, upperBound);
  const normalizedValue = (clampedReading - lowerBound) / (upperBound - lowerBound);

  return clampSignalValue(order === "decreasing" ? 1 - normalizedValue : normalizedValue);
}

export function normalizedToReading(normalizedValue: number, minValue: number, maxValue: number, order: SignalOrder) {
  const { minValue: lowerBound, maxValue: upperBound } = normalizeSignalRange(minValue, maxValue);
  const clampedNormalizedValue = clampSignalValue(normalizedValue);
  const orderedNormalizedValue = order === "decreasing" ? 1 - clampedNormalizedValue : clampedNormalizedValue;

  return lowerBound + orderedNormalizedValue * (upperBound - lowerBound);
}

function normalizeSignalOrder(order: string): SignalOrder {
  return order === "decreasing" ? "decreasing" : "increasing";
}

export function getNormalizedSignalValue(reading: number, minValue: number, maxValue: number, order: SignalOrder) {
  return readingToNormalized(reading, minValue, maxValue, order);
}

function normalizeSignal(signal: RawCardSignal, index: number): CardLayoutSignal {
  const order = normalizeSignalOrder(signal.order);

  // Keep reading precision for field position continuity; display rounding stays in UI.
  const snappedMinValue = snapReadingToInteger(signal.minValue);
  const snappedMaxValue = snapReadingToInteger(signal.maxValue);
  const { minValue, maxValue } = normalizeSignalRange(snappedMinValue, snappedMaxValue);
  const rawReading = Number.isFinite(signal.reading) ? signal.reading : minValue;
  const reading = clampReadingToSignalRange(rawReading, minValue, maxValue);

  return {
    id: signal.id,
    title: signal.title,
    value: getNormalizedSignalValue(reading, minValue, maxValue, order),
    reading,
    variant: signalVariants[index] ?? "movement",
    minValue,
    maxValue,
    isTheoreticalMin: signal.isTheoreticalMin,
    isTheoreticalMax: signal.isTheoreticalMax,
    unit: signal.unit,
    order,
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

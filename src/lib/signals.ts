export const SIGNAL_MIN = 1;
export const SIGNAL_MAX = 10;
export const DEFAULT_SIGNAL_READING = SIGNAL_MIN;
export const IMPLICIT_SIGNAL_IDS = ["0", "1", "2"] as const;
export type ImplicitSignalId = (typeof IMPLICIT_SIGNAL_IDS)[number];

export function clampSignalReading(reading: number) {
  if (!Number.isFinite(reading)) {
    return DEFAULT_SIGNAL_READING;
  }

  return Math.min(Math.max(reading, SIGNAL_MIN), SIGNAL_MAX);
}

export function roundSignalReadingForDisplay(reading: number) {
  return clampSignalReading(Math.round(reading));
}

export function roundSignalReadingForStorage(reading: number) {
  return Number(clampSignalReading(reading).toFixed(2));
}

export function signalReadingToNormalized(reading: number) {
  return (clampSignalReading(reading) - SIGNAL_MIN) / (SIGNAL_MAX - SIGNAL_MIN);
}

export function normalizedToSignalReading(normalizedValue: number) {
  const clampedNormalizedValue = Math.min(Math.max(normalizedValue, 0), 1);

  return SIGNAL_MIN + clampedNormalizedValue * (SIGNAL_MAX - SIGNAL_MIN);
}

import { clampSignalReading, roundSignalReadingForStorage, normalizedToSignalReading } from "./signals";

export type SignalGestureIntent = "pending" | "signal" | "cancelled";

export function getSignalGestureAxis(deltaX: number, deltaY: number): "horizontal" | "vertical" | null {
  const absoluteX = Math.abs(deltaX);
  const absoluteY = Math.abs(deltaY);

  if (absoluteX >= 8 && absoluteX > absoluteY) {
    return "horizontal";
  }

  if (absoluteY >= 8 && absoluteY > absoluteX) {
    return "vertical";
  }

  return null;
}

export function clampNormalized(value: number) {
  return Math.min(Math.max(value, 0), 1);
}

export function getFinalReadingFromNormalized(normalizedValue: number) {
  const reading = normalizedToSignalReading(normalizedValue);
  return roundSignalReadingForStorage(reading);
}

export function resolveSignalDragInteraction(
  startNormalized: number,
  deltaX: number,
  deltaY: number,
  movementRangePx: number,
  currentIntent: SignalGestureIntent
): {
  finalIntent: SignalGestureIntent;
  finalNormalized: number;
  finalReading: number;
  wasMoved: boolean;
} {
  const finalAxis = currentIntent === "pending" ? getSignalGestureAxis(deltaX, deltaY) : null;
  const finalIntent: SignalGestureIntent = currentIntent === "signal" || finalAxis === "horizontal" ? "signal" : "cancelled";
  
  const finalNormalized = clampNormalized(startNormalized + deltaX / movementRangePx);
  const finalReading = getFinalReadingFromNormalized(finalNormalized);
  const wasMoved = Math.hypot(deltaX, deltaY) >= 5; // deadZonePx is 5 in the codebase typically

  return {
    finalIntent,
    finalNormalized,
    finalReading,
    wasMoved,
  };
}

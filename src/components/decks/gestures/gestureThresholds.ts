export const DECK_GESTURE_THRESHOLDS = {
  deadZonePx: 10,
  verticalSwipeThresholdPx: 148,
  verticalSwipeViewportRatio: 0.22,
  horizontalFlipThresholdPx: 96,
  velocityAssistThresholdPxPerMs: 0.58,
  maxVelocityInfluencePx: 34,
  diagonalTolerancePx: 18,
  axisLockRatio: 1.35,
  activeCardDragResistance: 0.42,
  focusModeDragResistance: 0.36,
  cancelRestoreThresholdPx: 54,
} as const;

export type DeckGestureThresholds = typeof DECK_GESTURE_THRESHOLDS;

export function getVerticalCommitmentDistance(viewportHeight = 0) {
  if (viewportHeight <= 0) {
    return DECK_GESTURE_THRESHOLDS.verticalSwipeThresholdPx;
  }

  return Math.min(
    180,
    Math.max(
      DECK_GESTURE_THRESHOLDS.verticalSwipeThresholdPx,
      viewportHeight * DECK_GESTURE_THRESHOLDS.verticalSwipeViewportRatio
    )
  );
}

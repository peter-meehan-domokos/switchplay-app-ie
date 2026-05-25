"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { DECK_GESTURE_THRESHOLDS, getVerticalCommitmentDistance } from "@/components/decks/gestures/gestureThresholds";
import type {
  DeckGestureCallbacks,
  DeckGestureMode,
  DeckGestureResult,
  GestureCommitment,
  GestureIntent,
  GesturePhase,
  GestureVector,
  SwipeDirection,
} from "@/components/decks/gestures/gestureTypes";

type GesturePoint = {
  x: number;
  y: number;
  time: number;
};

type GestureAxis = "x" | "y" | null;

type GestureSession = {
  pointerId: number;
  start: GesturePoint;
  last: GesturePoint;
  axis: GestureAxis;
};

type UseDeckGesturesOptions = DeckGestureCallbacks & {
  mode?: DeckGestureMode;
  disabled?: boolean;
  locked?: boolean;
  allowedIntents?: GestureIntent[];
  viewportHeight?: number;
};

const emptyVector: GestureVector = {
  x: 0,
  y: 0,
  absoluteX: 0,
  absoluteY: 0,
  distance: 0,
  velocityX: 0,
  velocityY: 0,
  elapsedMs: 0,
};

const emptyCommitment: GestureCommitment = {
  intent: "none",
  direction: null,
  progress: 0,
  isCommitted: false,
  reason: null,
};

function getPoint(event: ReactPointerEvent<HTMLElement>): GesturePoint {
  return {
    x: event.clientX,
    y: event.clientY,
    time: performance.now(),
  };
}

function buildVector(start: GesturePoint, current: GesturePoint): GestureVector {
  const x = current.x - start.x;
  const y = current.y - start.y;
  const elapsedMs = Math.max(current.time - start.time, 1);

  return {
    x,
    y,
    absoluteX: Math.abs(x),
    absoluteY: Math.abs(y),
    distance: Math.hypot(x, y),
    velocityX: x / elapsedMs,
    velocityY: y / elapsedMs,
    elapsedMs,
  };
}

function getLockedAxis(vector: GestureVector, previousAxis: GestureAxis): GestureAxis {
  if (previousAxis) {
    return previousAxis;
  }

  if (vector.distance < DECK_GESTURE_THRESHOLDS.deadZonePx) {
    return null;
  }

  const { axisLockRatio, diagonalTolerancePx } = DECK_GESTURE_THRESHOLDS;
  const horizontalLead = vector.absoluteX - vector.absoluteY;
  const verticalLead = vector.absoluteY - vector.absoluteX;
  const hasClearHorizontalLead = horizontalLead >= diagonalTolerancePx || vector.absoluteY <= DECK_GESTURE_THRESHOLDS.deadZonePx / 2;
  const hasClearVerticalLead = verticalLead >= diagonalTolerancePx || vector.absoluteX <= DECK_GESTURE_THRESHOLDS.deadZonePx / 2;

  if (vector.absoluteX >= vector.absoluteY * axisLockRatio && hasClearHorizontalLead) {
    return "x";
  }

  if (vector.absoluteY >= vector.absoluteX * axisLockRatio && hasClearVerticalLead) {
    return "y";
  }

  return null;
}

function getDirection(axis: GestureAxis, vector: GestureVector): SwipeDirection | null {
  if (axis === "x") {
    return vector.x >= 0 ? "right" : "left";
  }

  if (axis === "y") {
    return vector.y >= 0 ? "down" : "up";
  }

  return null;
}

function getIntent(mode: DeckGestureMode, direction: SwipeDirection | null): GestureIntent {
  // Raw direction becomes semantic deck intent here; parent components decide the transition.
  if (direction === "down") {
    return "settleToPast";
  }

  if (direction === "up") {
    return "restoreFromPast";
  }

  if (direction === "left" || direction === "right") {
    return "flip";
  }

  return "none";
}

function getCommitment(intent: GestureIntent, direction: SwipeDirection | null, vector: GestureVector, viewportHeight?: number): GestureCommitment {
  if (intent === "none" || !direction) {
    return emptyCommitment;
  }

  const isHorizontal = direction === "left" || direction === "right";
  const baseDistance = isHorizontal
    ? DECK_GESTURE_THRESHOLDS.horizontalFlipThresholdPx
    : getVerticalCommitmentDistance(viewportHeight);
  const axisDistance = isHorizontal ? vector.absoluteX : vector.absoluteY;
  const axisVelocity = Math.abs(isHorizontal ? vector.velocityX : vector.velocityY);
  const velocityInfluence =
    axisDistance >= DECK_GESTURE_THRESHOLDS.cancelRestoreThresholdPx &&
    axisVelocity >= DECK_GESTURE_THRESHOLDS.velocityAssistThresholdPxPerMs
      ? Math.min(
          DECK_GESTURE_THRESHOLDS.maxVelocityInfluencePx,
          (axisVelocity - DECK_GESTURE_THRESHOLDS.velocityAssistThresholdPxPerMs) * 80
        )
      : 0;
  const assistedDistance = axisDistance + velocityInfluence;
  const isCommitted = assistedDistance >= baseDistance;

  return {
    intent,
    direction,
    progress: Math.min(1, assistedDistance / baseDistance),
    isCommitted,
    reason: isCommitted ? (axisDistance >= baseDistance ? "distance" : "velocityAssist") : null,
  };
}

function isIntentAllowed(intent: GestureIntent, allowedIntents?: GestureIntent[]) {
  return !allowedIntents || allowedIntents.includes(intent);
}

function getPreviewVector(mode: DeckGestureMode, vector: GestureVector): GestureVector {
  const resistance =
    mode === "focus"
      ? DECK_GESTURE_THRESHOLDS.focusModeDragResistance
      : DECK_GESTURE_THRESHOLDS.activeCardDragResistance;

  return {
    ...vector,
    x: vector.x * resistance,
    y: vector.y * resistance,
    absoluteX: vector.absoluteX * resistance,
    absoluteY: vector.absoluteY * resistance,
    distance: vector.distance * resistance,
  };
}

function dispatchCommittedGesture(
  intent: GestureIntent,
  commitment: GestureCommitment,
  vector: GestureVector,
  callbacks: DeckGestureCallbacks
) {
  switch (intent) {
    case "settleToPast":
      callbacks.onSettleToPast?.(commitment, vector);
      break;
    case "restoreFromPast":
      callbacks.onRestoreFromPast?.(commitment, vector);
      break;
    case "focus":
      callbacks.onFocus?.(commitment, vector);
      break;
    case "defocus":
      callbacks.onDefocus?.(commitment, vector);
      break;
    case "flip":
      callbacks.onFlip?.(commitment, vector);
      break;
    case "none":
      break;
  }
}

// Interprets gesture intent only; UI rendering and animation orchestration stay with parent components.
export function useDeckGestures({
  mode = "deck",
  disabled = false,
  locked = false,
  allowedIntents,
  viewportHeight,
  onSettleToPast,
  onRestoreFromPast,
  onFlip,
  onFocus,
  onDefocus,
}: UseDeckGesturesOptions = {}): DeckGestureResult {
  const sessionRef = useRef<GestureSession | null>(null);
  const [phase, setPhase] = useState<GesturePhase>("idle");
  const [vector, setVector] = useState<GestureVector>(emptyVector);
  const [intent, setIntent] = useState<GestureIntent>("none");
  const [direction, setDirection] = useState<SwipeDirection | null>(null);
  const [commitment, setCommitment] = useState<GestureCommitment>(emptyCommitment);
  const callbacksRef = useRef({ onSettleToPast, onRestoreFromPast, onFlip, onFocus, onDefocus });

  callbacksRef.current = { onSettleToPast, onRestoreFromPast, onFlip, onFocus, onDefocus };

  const resetGesture = useCallback((nextPhase: GesturePhase) => {
    sessionRef.current = null;
    setPhase(nextPhase);
    setVector(emptyVector);
    setIntent("none");
    setDirection(null);
    setCommitment(nextPhase === "cancelled" ? { ...emptyCommitment, reason: "cancelled" } : emptyCommitment);
  }, []);

  useEffect(() => {
    if (disabled || locked) {
      resetGesture("idle");
    }
  }, [disabled, locked, resetGesture]);

  const updateGesture = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const session = sessionRef.current;

      if (!session || event.pointerId !== session.pointerId) {
        return;
      }

      const nextPoint = getPoint(event);
      const nextVector = buildVector(session.start, nextPoint);
      const nextAxis = getLockedAxis(nextVector, session.axis);
      const nextDirection = getDirection(nextAxis, nextVector);
      const nextIntent = getIntent(mode, nextDirection);
      const nextCommitment = isIntentAllowed(nextIntent, allowedIntents)
        ? getCommitment(nextIntent, nextDirection, nextVector, viewportHeight)
        : emptyCommitment;

      if (nextAxis) {
        event.preventDefault();
      }

      sessionRef.current = {
        ...session,
        last: nextPoint,
        axis: nextAxis,
      };

      setVector(nextVector);
      setDirection(nextDirection);
      setIntent(nextIntent);
      setCommitment(nextCommitment);
      setPhase(nextAxis ? "dragging" : "tracking");
    },
    [allowedIntents, mode, viewportHeight]
  );

  const handlers = useMemo(
    () => ({
      onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
        if (disabled || locked || event.button !== 0) {
          return;
        }

        const start = getPoint(event);
        sessionRef.current = {
          pointerId: event.pointerId,
          start,
          last: start,
          axis: null,
        };
        event.currentTarget.setPointerCapture?.(event.pointerId);
        setVector(emptyVector);
        setDirection(null);
        setIntent("none");
        setCommitment(emptyCommitment);
        setPhase("tracking");
      },
      onPointerMove: (event: ReactPointerEvent<HTMLElement>) => {
        updateGesture(event);
      },
      onPointerUp: (event: ReactPointerEvent<HTMLElement>) => {
        const session = sessionRef.current;

        if (!session || event.pointerId !== session.pointerId) {
          return;
        }

        updateGesture(event);
        event.currentTarget.releasePointerCapture?.(event.pointerId);

        const finalVector = buildVector(session.start, getPoint(event));
        const finalSession = sessionRef.current ?? session;
        const finalAxis = getLockedAxis(finalVector, finalSession.axis);
        const finalDirection = getDirection(finalAxis, finalVector);
        const finalIntent = getIntent(mode, finalDirection);
        const finalCommitment = isIntentAllowed(finalIntent, allowedIntents)
          ? getCommitment(finalIntent, finalDirection, finalVector, viewportHeight)
          : emptyCommitment;

        if (finalVector.distance >= DECK_GESTURE_THRESHOLDS.deadZonePx) {
          event.preventDefault();
        }

        if (finalCommitment.isCommitted) {
          setPhase("committed");
          dispatchCommittedGesture(finalIntent, finalCommitment, finalVector, callbacksRef.current);
        } else {
          setPhase("cancelled");
        }

        sessionRef.current = null;
      },
      onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => {
        if (sessionRef.current?.pointerId === event.pointerId) {
          event.currentTarget.releasePointerCapture?.(event.pointerId);
        }

        resetGesture("cancelled");
      },
    }),
    [allowedIntents, disabled, locked, mode, resetGesture, updateGesture, viewportHeight]
  );

  return {
    phase,
    intent,
    direction,
    vector,
    previewVector: getPreviewVector(mode, vector),
    commitment,
    handlers,
  };
}

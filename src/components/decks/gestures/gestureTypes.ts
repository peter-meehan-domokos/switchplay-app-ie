import type { PointerEventHandler } from "react";

export type GesturePhase = "idle" | "tracking" | "dragging" | "committed" | "cancelled";

export type SwipeDirection = "up" | "down" | "left" | "right";

export type GestureIntent = "none" | "swipeDown" | "swipeUp" | "flip" | "focus" | "defocus";

export type DeckGestureMode = "deck" | "focus";

export type GestureVector = {
  x: number;
  y: number;
  absoluteX: number;
  absoluteY: number;
  distance: number;
  velocityX: number;
  velocityY: number;
  elapsedMs: number;
};

export type GestureCommitment = {
  intent: GestureIntent;
  direction: SwipeDirection | null;
  progress: number;
  isCommitted: boolean;
  reason: "distance" | "velocityAssist" | "cancelled" | null;
};

export type DeckGestureCallbacks = {
  onSwipeDown?: (commitment: GestureCommitment, vector: GestureVector) => void;
  onSwipeUp?: (commitment: GestureCommitment, vector: GestureVector) => void;
  onFlip?: (commitment: GestureCommitment, vector: GestureVector) => void;
  onFocus?: (commitment: GestureCommitment, vector: GestureVector) => void;
  onDefocus?: (commitment: GestureCommitment, vector: GestureVector) => void;
};

export type DeckGestureHandlers = {
  onPointerDown: PointerEventHandler<HTMLElement>;
  onPointerMove: PointerEventHandler<HTMLElement>;
  onPointerUp: PointerEventHandler<HTMLElement>;
  onPointerCancel: PointerEventHandler<HTMLElement>;
};

export type DeckGestureResult = {
  phase: GesturePhase;
  intent: GestureIntent;
  direction: SwipeDirection | null;
  vector: GestureVector;
  previewVector: GestureVector;
  commitment: GestureCommitment;
  handlers: DeckGestureHandlers;
};

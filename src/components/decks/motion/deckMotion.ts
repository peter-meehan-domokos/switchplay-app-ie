import type { Transition } from "motion/react";

// Motion feel and timing constants only; state changes are orchestrated elsewhere.
export const deckMotionDurations = {
  traversal: 0.36,
  focus: 0.42,
  defocus: 0.34,
  flip: 0.68,
  restore: 0.24,
  cancel: 0.2,
} as const;

export const deckMotionEasing = {
  calm: [0.22, 0.72, 0.18, 1],
  damped: [0.2, 0.68, 0.18, 1],
  restore: [0.24, 0.64, 0.22, 1],
} as const;

export const deckMotionTransitions = {
  traversal: {
    duration: deckMotionDurations.traversal,
    ease: deckMotionEasing.damped,
  },
  focus: {
    duration: deckMotionDurations.focus,
    ease: deckMotionEasing.calm,
  },
  defocus: {
    duration: deckMotionDurations.defocus,
    ease: deckMotionEasing.restore,
  },
  flip: {
    duration: deckMotionDurations.flip,
    ease: deckMotionEasing.calm,
  },
  restore: {
    duration: deckMotionDurations.restore,
    ease: deckMotionEasing.restore,
  },
  cancel: {
    duration: deckMotionDurations.cancel,
    ease: deckMotionEasing.restore,
  },
} as const satisfies Record<string, Transition>;

export function getDeckTraversalTransition() {
  return deckMotionTransitions.traversal;
}

export function getDeckFocusTransition() {
  return deckMotionTransitions.focus;
}

export function getDeckDefocusTransition() {
  return deckMotionTransitions.defocus;
}

export function getDeckFlipTransition() {
  return deckMotionTransitions.flip;
}

export function getDeckRestoreTransition() {
  return deckMotionTransitions.restore;
}

export function getDeckCancelTransition() {
  return deckMotionTransitions.cancel;
}

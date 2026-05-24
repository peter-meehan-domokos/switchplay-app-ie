export type DeckSide = "front" | "back";

export type DeckTransitionDirection = "next" | "previous" | "focus" | "defocus" | "flip" | null;

export type DeckViewMode = "stack" | "focus";

// Shared transition state shape and pure helpers; React storage stays with components.
export type DeckTransitionState = {
  activeCardIndex: number;
  mode: DeckViewMode;
  side: DeckSide;
  isTraversing: boolean;
  isGestureLocked: boolean;
  isAnimationLocked: boolean;
  direction: DeckTransitionDirection;
};

export function createDeckTransitionState(activeCardIndex = 0): DeckTransitionState {
  return {
    activeCardIndex,
    mode: "stack",
    side: "front",
    isTraversing: false,
    isGestureLocked: false,
    isAnimationLocked: false,
    direction: null,
  };
}

export function focusDeckCard(state: DeckTransitionState, activeCardIndex = state.activeCardIndex): DeckTransitionState {
  return {
    ...state,
    activeCardIndex,
    mode: "focus",
    side: "front",
    direction: "focus",
  };
}

export function defocusDeckCard(state: DeckTransitionState): DeckTransitionState {
  return {
    ...state,
    mode: "stack",
    side: "front",
    direction: "defocus",
  };
}

export function flipDeckCard(state: DeckTransitionState): DeckTransitionState {
  return {
    ...state,
    side: state.side === "front" ? "back" : "front",
    direction: "flip",
  };
}

export function beginDeckTraversal(
  state: DeckTransitionState,
  nextCardIndex: number,
  direction: "next" | "previous"
): DeckTransitionState {
  return {
    ...state,
    activeCardIndex: nextCardIndex,
    isTraversing: true,
    isAnimationLocked: true,
    isGestureLocked: true,
    direction,
  };
}

export function settleDeckTransition(state: DeckTransitionState): DeckTransitionState {
  return {
    ...state,
    isTraversing: false,
    isAnimationLocked: false,
    isGestureLocked: false,
    direction: null,
  };
}

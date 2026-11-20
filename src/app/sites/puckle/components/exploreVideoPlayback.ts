export type VisibilityAction = "play" | "pause" | "none";

export type VisibilityDecisionInput = {
  /** Enough of the player is on screen to start playback. */
  isVisible: boolean;
  /** The student deliberately paused; automatic playback must not override it. */
  isUserPaused: boolean;
  isFullscreen: boolean;
  prefersReducedMotion: boolean;
  isPlaying: boolean;
};

/**
 * Pure decision for what the viewport observer should do. Fullscreen suspends all automatic changes, a deliberate
 * pause is never overridden, and reduced motion never starts playback by itself.
 */
export function decideVisibilityAction(input: VisibilityDecisionInput): VisibilityAction {
  if (input.isFullscreen) return "none";
  if (!input.isVisible) return input.isPlaying ? "pause" : "none";
  if (input.isUserPaused || input.prefersReducedMotion || input.isPlaying) return "none";
  return "play";
}

export type PauseEventInput = {
  /** The pause was requested by our own visibility logic. */
  wasAutomatic: boolean;
  hasEnded: boolean;
  /** The pause came from the iPhone native fullscreen player, i.e. the student used its controls. */
  isNativeFullscreen: boolean;
};

/**
 * Pause events with no handler behind them are browser-initiated (tab hidden, interruptions, fullscreen exit) and are
 * not a student decision. Pauses made in the iPhone native fullscreen player are the exception: its controls are the
 * student's only way to pause there, and they bypass our handlers.
 */
export function isDeliberatePauseEvent(input: PauseEventInput): boolean {
  if (input.wasAutomatic || input.hasEnded) return false;
  return input.isNativeFullscreen;
}

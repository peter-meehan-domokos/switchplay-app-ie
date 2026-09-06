export type VideoPlaybackIntent = "idle" | "continue" | "paused";

export function shouldRecordPlaybackPause(input: { hasEnded: boolean; isInternalTransition: boolean }) {
  return !input.hasEnded && !input.isInternalTransition;
}

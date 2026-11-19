export type ExploreVideoLayoutInput = {
  currentTime: number;
  duration: number;
  isPaused: boolean;
  isFullscreen: boolean;
  isFullscreenAvailable: boolean;
};

export type ExploreVideoLayout = {
  elapsedLabel: string;
  durationLabel: string;
  seekMax: number;
  seekValue: number;
  playbackLabel: "Play" | "Pause";
  fullscreenLabel: "Enter fullscreen" | "Exit fullscreen";
  showFullscreenButton: boolean;
  seekValueText: string;
};

export function formatClock(seconds: number): string {
  const whole = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

export function buildExploreVideoLayout(input: ExploreVideoLayoutInput): ExploreVideoLayout {
  const duration = Number.isFinite(input.duration) && input.duration > 0 ? input.duration : 0;
  const seekValue = Math.min(Math.max(input.currentTime, 0), duration);
  return {
    elapsedLabel: formatClock(seekValue),
    durationLabel: formatClock(duration),
    seekMax: duration,
    seekValue,
    playbackLabel: input.isPaused ? "Play" : "Pause",
    fullscreenLabel: input.isFullscreen ? "Exit fullscreen" : "Enter fullscreen",
    showFullscreenButton: input.isFullscreenAvailable,
    seekValueText: `${formatClock(seekValue)} of ${formatClock(duration)}`,
  };
}

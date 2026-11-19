import assert from "node:assert/strict";
import test from "node:test";
import { buildExploreVideoLayout, formatClock } from "../src/app/sites/puckle/components/exploreVideoLayout";
import { decideVisibilityAction, isDeliberatePauseEvent } from "../src/app/sites/puckle/components/exploreVideoPlayback";

const base = { isVisible: true, isUserPaused: false, isFullscreen: false, prefersReducedMotion: false, isPlaying: false };

test("visibility starts playback only when nothing says otherwise", () => {
  assert.equal(decideVisibilityAction(base), "play");
  assert.equal(decideVisibilityAction({ ...base, isPlaying: true }), "none");
  assert.equal(decideVisibilityAction({ ...base, isUserPaused: true }), "none");
  assert.equal(decideVisibilityAction({ ...base, prefersReducedMotion: true }), "none");
});

test("leaving the viewport pauses only playing video, and fullscreen suspends all automatic changes", () => {
  assert.equal(decideVisibilityAction({ ...base, isVisible: false, isPlaying: true }), "pause");
  assert.equal(decideVisibilityAction({ ...base, isVisible: false }), "none");
  assert.equal(decideVisibilityAction({ ...base, isFullscreen: true }), "none");
  assert.equal(decideVisibilityAction({ ...base, isFullscreen: true, isVisible: false, isPlaying: true }), "none");
});

test("a deliberate pause survives leaving and returning", () => {
  assert.equal(decideVisibilityAction({ ...base, isUserPaused: true, isVisible: false }), "none");
  assert.equal(decideVisibilityAction({ ...base, isUserPaused: true }), "none");
});

test("only pauses in the iPhone native player count as deliberate when no handler was involved", () => {
  assert.equal(isDeliberatePauseEvent({ wasAutomatic: true, hasEnded: false, isNativeFullscreen: false }), false);
  assert.equal(isDeliberatePauseEvent({ wasAutomatic: false, hasEnded: false, isNativeFullscreen: false }), false);
  assert.equal(isDeliberatePauseEvent({ wasAutomatic: false, hasEnded: true, isNativeFullscreen: true }), false);
  assert.equal(isDeliberatePauseEvent({ wasAutomatic: false, hasEnded: false, isNativeFullscreen: true }), true);
});

test("layout formats the clock and clamps the seek value", () => {
  assert.equal(formatClock(77.1), "1:17");
  assert.equal(formatClock(Number.NaN), "0:00");
  const layout = buildExploreVideoLayout({ currentTime: 99, duration: 77.1, isPaused: true, isFullscreen: false, isFullscreenAvailable: false });
  assert.equal(layout.seekValue, 77.1);
  assert.equal(layout.playbackLabel, "Play");
  assert.equal(layout.showFullscreenButton, false);
  assert.equal(layout.seekValueText, "1:17 of 1:17");
  assert.equal(buildExploreVideoLayout({ currentTime: 0, duration: 0, isPaused: false, isFullscreen: true, isFullscreenAvailable: true }).fullscreenLabel, "Exit fullscreen");
});

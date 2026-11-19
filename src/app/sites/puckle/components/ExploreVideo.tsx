"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type CSSProperties } from "react";
import { CollapseVideoIcon, ExpandVideoIcon } from "@/components/icons/videoControlIcons";
import { buildExploreVideoLayout } from "./exploreVideoLayout";
import { decideVisibilityAction, isDeliberatePauseEvent } from "./exploreVideoPlayback";
import styles from "./ExploreVideo.module.css";

type WebkitVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void };

type ExploreVideoProps = {
  src: string;
  poster: string;
  width: number;
  height: number;
  label: string;
};

/** Fraction of the player that must be on screen to start playback, and below which an automatic pause is applied. */
const PLAY_RATIO = 0.6;
const PAUSE_RATIO = 0.25;

export default function ExploreVideo({ src, poster, width, height, label }: ExploreVideoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<WebkitVideo>(null);
  // Playback intent lives in refs: it is read from event handlers and must not trigger renders.
  const userPausedRef = useRef(false);
  const automaticPauseRef = useRef(false);
  const visibleRef = useRef(false);
  const fullscreenRef = useRef(false);
  const nativeFullscreenRef = useRef(false);
  const reducedMotionRef = useRef(false);

  // Isolated ephemeral UI state, used only to render the control strip.
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPaused, setIsPaused] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFullscreenAvailable, setIsFullscreenAvailable] = useState(false);

  const layout = buildExploreVideoLayout({ currentTime, duration, isPaused, isFullscreen, isFullscreenAvailable });

  const startPlayback = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const result = video.play();
    // Autoplay can be blocked: the poster and the manual controls stay usable, so the rejection is expected.
    if (result instanceof Promise) result.catch(() => setIsPaused(true));
  }, []);

  const applyVisibility = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const action = decideVisibilityAction({
      isVisible: visibleRef.current,
      isUserPaused: userPausedRef.current,
      isFullscreen: fullscreenRef.current,
      prefersReducedMotion: reducedMotionRef.current,
      isPlaying: !video.paused,
    });
    if (action === "play") startPlayback();
    if (action === "pause") {
      automaticPauseRef.current = true;
      video.pause();
    }
  }, [startPlayback]);

  useEffect(() => {
    const container = containerRef.current;
    const video = videoRef.current;
    if (!container || !video) return;

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = motion.matches;
    const handleMotion = () => {
      reducedMotionRef.current = motion.matches;
    };
    motion.addEventListener("change", handleMotion);

    setIsFullscreenAvailable(
      typeof container.requestFullscreen === "function" || typeof video.webkitEnterFullscreen === "function"
    );

    const observer = new IntersectionObserver(
      (entries) => {
        const ratio = entries[entries.length - 1]?.intersectionRatio ?? 0;
        if (ratio >= PLAY_RATIO) visibleRef.current = true;
        else if (ratio < PAUSE_RATIO) visibleRef.current = false;
        else return;
        applyVisibility();
      },
      { threshold: [0, PAUSE_RATIO, PLAY_RATIO] }
    );
    observer.observe(container);

    const handlePlay = () => setIsPaused(false);
    const handlePause = () => {
      setIsPaused(true);
      const wasAutomatic = automaticPauseRef.current;
      automaticPauseRef.current = false;
      if (isDeliberatePauseEvent({ wasAutomatic, hasEnded: video.ended, isNativeFullscreen: nativeFullscreenRef.current })) {
        userPausedRef.current = true;
      }
    };
    const handleTime = () => setCurrentTime(video.currentTime);
    const handleDuration = () => setDuration(video.duration);
    const handleFullscreenChange = () => {
      const active = document.fullscreenElement === container;
      fullscreenRef.current = active;
      setIsFullscreen(active);
      if (!active) applyVisibility();
    };
    const handleNativeBegin = () => {
      nativeFullscreenRef.current = true;
      fullscreenRef.current = true;
    };
    const handleNativeEnd = () => {
      nativeFullscreenRef.current = false;
      fullscreenRef.current = false;
      applyVisibility();
    };

    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("timeupdate", handleTime);
    video.addEventListener("seeked", handleTime);
    video.addEventListener("loadedmetadata", handleDuration);
    video.addEventListener("durationchange", handleDuration);
    video.addEventListener("webkitbeginfullscreen", handleNativeBegin);
    video.addEventListener("webkitendfullscreen", handleNativeEnd);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    handleDuration();

    return () => {
      motion.removeEventListener("change", handleMotion);
      observer.disconnect();
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("timeupdate", handleTime);
      video.removeEventListener("seeked", handleTime);
      video.removeEventListener("loadedmetadata", handleDuration);
      video.removeEventListener("durationchange", handleDuration);
      video.removeEventListener("webkitbeginfullscreen", handleNativeBegin);
      video.removeEventListener("webkitendfullscreen", handleNativeEnd);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [applyVisibility]);

  // The control handlers are where a deliberate decision is recorded.
  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      userPausedRef.current = false;
      startPlayback();
    } else {
      userPausedRef.current = true;
      video.pause();
    }
  };

  const handleSeek = (event: ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const next = Number(event.target.value);
    video.currentTime = next;
    setCurrentTime(next);
  };

  const toggleFullscreen = () => {
    const container = containerRef.current;
    const video = videoRef.current;
    if (!container || !video) return;
    if (document.fullscreenElement === container) {
      void document.exitFullscreen();
      return;
    }
    if (typeof container.requestFullscreen === "function") {
      // Whole container, so the control strip stays available in fullscreen.
      void container.requestFullscreen().catch(() => undefined);
    } else {
      // iPhone Safari only fullscreens the video element itself, with Apple's own controls.
      video.webkitEnterFullscreen?.();
    }
  };

  return (
    <div className={styles.player} ref={containerRef} data-fullscreen={isFullscreen ? "true" : "false"}>
      <video
        aria-label={label}
        className={styles.video}
        height={height}
        loop
        muted
        onClick={togglePlayback}
        playsInline
        poster={poster}
        preload="metadata"
        ref={videoRef}
        src={src}
        style={{ "--explore-video-ratio": `${width} / ${height}` } as CSSProperties}
        width={width}
      />
      <div className={styles.strip}>
        <button
          aria-label={layout.playbackLabel}
          className={styles.stripButton}
          onClick={togglePlayback}
          type="button"
        >
          {isPaused ? <span aria-hidden="true" className={styles.playIcon} /> : <span aria-hidden="true" className={styles.pauseIcon} />}
        </button>
        <span className={styles.time}>{layout.elapsedLabel}</span>
        <input
          aria-label="Seek"
          aria-valuetext={layout.seekValueText}
          className={styles.seek}
          max={layout.seekMax}
          min={0}
          onChange={handleSeek}
          step={0.1}
          type="range"
          value={layout.seekValue}
        />
        <span className={styles.time}>{layout.durationLabel}</span>
        {layout.showFullscreenButton ? (
          <button
            aria-label={layout.fullscreenLabel}
            className={styles.stripButton}
            onClick={toggleFullscreen}
            type="button"
          >
            {isFullscreen ? <CollapseVideoIcon className={styles.icon} /> : <ExpandVideoIcon className={styles.icon} />}
          </button>
        ) : null}
      </div>
    </div>
  );
}

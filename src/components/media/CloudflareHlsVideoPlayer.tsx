"use client";

import type { VideoLoadGuard } from "./publishedVideo";
import Hls from "hls.js";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
} from "react";
import { CloseVideoIcon, CollapseVideoIcon, DeckIntroSemiExpandIcon, ExpandVideoIcon } from "@/components/icons/videoControlIcons";
import { shouldRecordPlaybackPause, type VideoPlaybackIntent } from "@/components/media/videoPlaybackState";
import type { CloudflareStreamVideoMediaItem } from "@/lib/media";
import { getCloudflareStreamHlsManifestUrl, getCloudflareStreamThumbnailUrl } from "@/lib/cloudflareStreamPlayback";
import { isPhase2MockVideo, PHASE2_MOCK_VIDEO_NOTICE } from "@/lib/phase2MediaFixture";

export type { VideoPlaybackIntent } from "@/components/media/videoPlaybackState";

export type VideoPlaybackState = "idle" | "loading" | "playing" | "paused" | "ended" | "blocked" | "failed";

export type CloudflareHlsVideoPlayerHandle = {
  loadMedia: (mediaItem: CloudflareStreamVideoMediaItem, options?: { shouldPlay?: boolean; beforeLoad?: VideoLoadGuard }) => void;
  pausePlayback: (reason?: string) => void;
  pauseAndReset: (reason?: string) => void;
  togglePlayback: () => void;
};

type CloudflareHlsVideoPlayerProps = {
  beforeLoad?: VideoLoadGuard;
  displayMode?: "embedded" | "expanded";
  mediaItem?: CloudflareStreamVideoMediaItem | null;
  onMediaDisplayStateChange?: (state: { assetId: string; state: "failed" | "renderable" }) => void;
  onPlaybackIntentChange?: (intent: VideoPlaybackIntent) => void;
  onPlaybackStateChange?: (state: { assetId: string | null; state: VideoPlaybackState }) => void;
  onRequestCollapse?: () => void;
  onRequestExpand?: () => void;
  previewControlDisabled?: boolean;
  previewLabel?: string;
  variant?: "standard" | "deck-preview";
};

type InternalTransition = {
  token: number;
  timeoutId: number | null;
};

const INTERNAL_TRANSITION_GUARD_MS = 4_000;

function stopPlayerControlPropagation(event: PointerEvent<HTMLButtonElement>) {
  event.stopPropagation();
}

function canPlayNativeHls(video: HTMLVideoElement) {
  return Boolean(
    video.canPlayType("application/vnd.apple.mpegurl") ||
      video.canPlayType("application/x-mpegURL")
  );
}

function isCurrentOperation(currentOperationId: number, operationId: number) {
  return currentOperationId === operationId;
}

// TEMP DIAGNOSTIC: instance counter for comparing DeckGrid vs DeckDetail player identity at runtime.
let diagPlayerInstanceCounter = 0;

const CloudflareHlsVideoPlayer = forwardRef<CloudflareHlsVideoPlayerHandle, CloudflareHlsVideoPlayerProps>(
  function CloudflareHlsVideoPlayer(
    {
      beforeLoad,
      displayMode = "embedded",
      mediaItem,
      onMediaDisplayStateChange,
      onPlaybackIntentChange,
      onPlaybackStateChange,
      onRequestCollapse,
      onRequestExpand,
      previewControlDisabled = false,
      previewLabel = "Introduction video",
      variant = "standard",
    },
    ref
  ) {
    const guardedSelection = useRef<{ guard: VideoLoadGuard; assetId: string } | null>(null);
    const pendingLoad = useRef<AbortController | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    // TEMP DIAGNOSTIC: stable instance id + native <video> id for tracing player identity across expand/collapse.
    const diagInstanceIdRef = useRef<number | null>(null);
    if (diagInstanceIdRef.current === null) {
      diagInstanceIdRef.current = ++diagPlayerInstanceCounter;
    }
    const diagInstanceId = diagInstanceIdRef.current;
    const diagVideoElementIdRef = useRef<string | null>(null);
    const hlsRef = useRef<Hls | null>(null);
    const activeAssetIdRef = useRef<string | null>(null);
    const activeManifestUrlRef = useRef<string | null>(null);
    const operationIdRef = useRef(0);
    const sourceGenerationRef = useRef(0);
    const removeReadinessListenersRef = useRef<(() => void) | null>(null);
    const [displayableAssetId, setDisplayableAssetId] = useState<string | null>(null);
    const internalTransitionRef = useRef<InternalTransition | null>(null);
    const [isPlayable, setIsPlayable] = useState(false);
    const [hasFailed, setHasFailed] = useState(false);
    const [isPaused, setIsPaused] = useState(true);
    const [isEnded, setIsEnded] = useState(false);
    const isExpandedMode = displayMode === "expanded";
    const isDeckPreview = variant === "deck-preview";
    const manifestUrl = useMemo(() => mediaItem ? getCloudflareStreamHlsManifestUrl(mediaItem) : null, [mediaItem]);
    const posterUrl = useMemo(() => mediaItem ? getCloudflareStreamThumbnailUrl(mediaItem) : null, [mediaItem]);

    const emitPlaybackState = useCallback((state: VideoPlaybackState, assetId = activeAssetIdRef.current) => {
      onPlaybackStateChange?.({ assetId, state });
    }, [onPlaybackStateChange]);

    const clearInternalTransition = useCallback((token?: number) => {
      const transition = internalTransitionRef.current;

      if (!transition || (token !== undefined && transition.token !== token)) {
        return;
      }

      if (transition.timeoutId !== null) {
        window.clearTimeout(transition.timeoutId);
      }

      internalTransitionRef.current = null;
    }, []);

    const beginInternalTransition = useCallback(() => {
      const token = operationIdRef.current + 1;

      clearInternalTransition();
      internalTransitionRef.current = {
        token,
        timeoutId: window.setTimeout(() => clearInternalTransition(token), INTERNAL_TRANSITION_GUARD_MS),
      };

      return token;
    }, [clearInternalTransition]);

    const destroyHls = useCallback(() => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
    }, []);

    const markRenderable = useCallback((assetId: string) => {
      setIsPlayable(true);
      setIsProcessing(false);
      setDisplayableAssetId(assetId);
      setHasFailed(false);
      onMediaDisplayStateChange?.({ assetId, state: "renderable" });
    }, [onMediaDisplayStateChange]);

    const markFailed = useCallback((assetId: string) => {
      sourceGenerationRef.current += 1;
      removeReadinessListenersRef.current?.();
      activeAssetIdRef.current = null;
      activeManifestUrlRef.current = null;
      setIsPlayable(false);
      setIsProcessing(false);
      setDisplayableAssetId(null);
      if (videoRef.current) videoRef.current.style.visibility = "hidden";
      setHasFailed(true);
      setIsPaused(true);
      emitPlaybackState("failed", assetId);
      onMediaDisplayStateChange?.({ assetId, state: "failed" });
    }, [emitPlaybackState, onMediaDisplayStateChange]);

    const requestUnmutedPlayback = useCallback((video: HTMLVideoElement, operationId: number) => {
      video.defaultMuted = false;
      video.muted = false;
      const playResult = video.play();

      if (playResult instanceof Promise) {
        void playResult
          .then(() => {
            if (isCurrentOperation(operationIdRef.current, operationId)) {
              clearInternalTransition();
            }
          })
          .catch((error) => {
            if (!isCurrentOperation(operationIdRef.current, operationId)) {
              return;
            }

            clearInternalTransition();
            setIsPlayable(false);
            setIsPaused(true);
            emitPlaybackState("blocked", activeAssetIdRef.current);
            onPlaybackIntentChange?.("paused");
            console.warn("Unable to play Cloudflare Stream HLS video.", error);
          });
      }
    }, [clearInternalTransition, emitPlaybackState, onPlaybackIntentChange]);

    const loadMediaDirect = useCallback((nextMediaItem: CloudflareStreamVideoMediaItem, options?: { shouldPlay?: boolean; beforeLoad?: VideoLoadGuard }) => {
      const video = videoRef.current;

      if (!video) {
        return;
      }

      const nextManifestUrl = getCloudflareStreamHlsManifestUrl(nextMediaItem);

      const isSameSource =
        activeAssetIdRef.current === nextMediaItem.assetId &&
        activeManifestUrlRef.current === nextManifestUrl;
      const operationId = operationIdRef.current + 1;

      if (isSameSource) {

        if (options?.shouldPlay) {
          operationIdRef.current = operationId;
          setIsEnded(false);
          emitPlaybackState("loading", nextMediaItem.assetId);
          requestUnmutedPlayback(video, operationId);
        }

        return;
      }

      operationIdRef.current = operationId;
      const sourceGeneration = ++sourceGenerationRef.current;
      removeReadinessListenersRef.current?.();
      // Clear synchronously: React state alone would leave the old frame visible
      // until the next commit, including while canonical authorization is pending.
      video.style.visibility = "hidden";
      setDisplayableAssetId(null);
      setIsProcessing(true);
      video.defaultMuted = false;
      video.muted = false;
      video.playsInline = true;
      setHasFailed(false);
      setIsPlayable(false);
      setIsPaused(true);
      setIsEnded(false);
      emitPlaybackState("loading", nextMediaItem.assetId);

      const transitionToken = beginInternalTransition();

      destroyHls();
      activeAssetIdRef.current = nextMediaItem.assetId;
      activeManifestUrlRef.current = nextManifestUrl;
      video.pause();
      video.removeAttribute("src");
      video.load();

      const handleFrameReady = () => {
        if (sourceGenerationRef.current !== sourceGeneration
          || activeAssetIdRef.current !== nextMediaItem.assetId
          || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
          || !video.currentSrc || video.currentSrc !== video.src) return;
        markRenderable(nextMediaItem.assetId);
      };
      for (const event of ["loadeddata", "canplay", "playing"]) video.addEventListener(event, handleFrameReady);
      removeReadinessListenersRef.current = () => {
        for (const event of ["loadeddata", "canplay", "playing"]) video.removeEventListener(event, handleFrameReady);
      };

      if (canPlayNativeHls(video)) {
        video.src = nextManifestUrl;
        video.load();
      } else if (Hls.isSupported()) {
        const hls = new Hls();

        hlsRef.current = hls;
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (sourceGenerationRef.current !== sourceGeneration || !data.fatal) {
            return;
          }

          clearInternalTransition(transitionToken);
          markFailed(nextMediaItem.assetId);
        });
        hls.attachMedia(video);
        hls.loadSource(nextManifestUrl);
      } else {
        video.src = nextManifestUrl;
        video.load();
      }

      if (options?.shouldPlay) {
        requestUnmutedPlayback(video, operationId);
      } else {
        window.setTimeout(() => clearInternalTransition(transitionToken), 0);
      }

    }, [
      beginInternalTransition,
      clearInternalTransition,
      destroyHls,
      markFailed,
      markRenderable,
      requestUnmutedPlayback,
      emitPlaybackState,
    ]);

    const loadMedia = useCallback((nextMediaItem: CloudflareStreamVideoMediaItem, options?: { shouldPlay?: boolean; beforeLoad?: VideoLoadGuard }) => {
      const guard = options?.beforeLoad ?? beforeLoad;
      if (!guard) { pendingLoad.current?.abort(); pendingLoad.current = null; loadMediaDirect(nextMediaItem, options); return; }
      // Display callbacks may change while a poster/overlay animates. That is
      // not a new playback request or permission to retry a failed status read.
      if (!options?.shouldPlay && guardedSelection.current?.guard === guard
        && guardedSelection.current.assetId === nextMediaItem.assetId) return;
      guardedSelection.current = { guard, assetId: nextMediaItem.assetId };
      pendingLoad.current?.abort();
      if (activeAssetIdRef.current !== nextMediaItem.assetId) {
        beginInternalTransition();
        removeReadinessListenersRef.current?.();
        sourceGenerationRef.current += 1;
        operationIdRef.current += 1;
        destroyHls();
        activeAssetIdRef.current = null;
        activeManifestUrlRef.current = null;
        setDisplayableAssetId(null);
        setIsPlayable(false);
        const video = videoRef.current;
        if (video) {
          video.style.visibility = "hidden";
          video.pause();
          video.removeAttribute("src");
          video.load();
        }
      }
      const abort = new AbortController(); pendingLoad.current = abort;
      setIsProcessing(true); setHasFailed(false); emitPlaybackState("loading", nextMediaItem.assetId);
      void guard(nextMediaItem, abort.signal).then(() => {
        if (abort.signal.aborted) return;
        pendingLoad.current = null; loadMediaDirect(nextMediaItem, options);
      }).catch(() => {
        if (abort.signal.aborted) return;
        setIsProcessing(false); pendingLoad.current = null; markFailed(nextMediaItem.assetId);
      });
    }, [beforeLoad, beginInternalTransition, destroyHls, emitPlaybackState, loadMediaDirect, markFailed]);

    const togglePlayback = useCallback(() => {
      const video = videoRef.current;

      if (!video || !activeAssetIdRef.current) {
        return;
      }

      if (video.paused || video.ended) {
        if (video.ended) {
          video.currentTime = 0;
        }

        operationIdRef.current += 1;
        setIsEnded(false);
        emitPlaybackState("loading");
        requestUnmutedPlayback(video, operationIdRef.current);
        return;
      }

      video.pause();
    }, [emitPlaybackState, requestUnmutedPlayback]);

    const pausePlayback = useCallback((reason: string = "unspecified") => {
      pendingLoad.current?.abort(); pendingLoad.current = null; setIsProcessing(false);
      const video = videoRef.current;

      if (!video || video.paused || video.ended) {
        return;
      }

      video.pause();
    }, []);

    const pauseAndReset = useCallback((reason: string = "unspecified") => {
      pendingLoad.current?.abort(); pendingLoad.current = null; setIsProcessing(false);
      const video = videoRef.current;

      clearInternalTransition();
      destroyHls();
      operationIdRef.current += 1;
      const transitionToken = beginInternalTransition();

      sourceGenerationRef.current += 1;
      removeReadinessListenersRef.current?.();
      activeAssetIdRef.current = null;
      activeManifestUrlRef.current = null;
      setDisplayableAssetId(null);
      if (video) video.style.visibility = "hidden";
      setIsPlayable(false);
      setHasFailed(false);
      setIsPaused(true);
      setIsEnded(false);
      emitPlaybackState("idle", null);

      if (!video) {
        clearInternalTransition(transitionToken);
        return;
      }

      video.pause();
      video.removeAttribute("src");
      video.load();
      window.setTimeout(() => clearInternalTransition(transitionToken), 0);
    }, [beginInternalTransition, clearInternalTransition, destroyHls, emitPlaybackState]);

    useImperativeHandle(
      ref,
      () => ({
        loadMedia,
        pausePlayback,
        pauseAndReset,
        togglePlayback,
      }),
      [loadMedia, pausePlayback, pauseAndReset, togglePlayback]
    );

    // Cleanup effect above must not re-fire when pauseAndReset's identity changes across renders.
    const pauseAndResetRef = useRef(pauseAndReset);
    useEffect(() => {
      pauseAndResetRef.current = pauseAndReset;
    }, [pauseAndReset]);

    useEffect(() => {

      if (mediaItem) {
        loadMedia(mediaItem, { shouldPlay: false });
      } else {
        guardedSelection.current = null;
      }
    }, [loadMedia, mediaItem, manifestUrl, diagInstanceId]);

    useEffect(() => {
      const video = videoRef.current;

      if (!video) {
        return;
      }

      const handleLoadStart = () => {
      };
      const handleDurationChange = () => {
      };
      const handleStalled = () => {
      };
      const handleAbort = () => {
      };
      const handleEmptied = () => {
      };
      const handlePlay = () => {
        if (!activeAssetIdRef.current || !video.currentSrc || video.currentSrc !== video.src) return;
        setIsPaused(false);
        setIsEnded(false);
        onPlaybackIntentChange?.("continue");
      };
      const handlePlaying = () => {
        if (!activeAssetIdRef.current || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
          || !video.currentSrc || video.currentSrc !== video.src) return;
        clearInternalTransition();
        setIsPaused(false);
        setIsEnded(false);
        emitPlaybackState("playing");
        onPlaybackIntentChange?.("continue");
      };
      const handlePause = () => {

        if (!shouldRecordPlaybackPause({
          hasEnded: video.ended,
          isInternalTransition: Boolean(internalTransitionRef.current),
        })) {
          return;
        }

        setIsPaused(true);
        emitPlaybackState("paused");
        onPlaybackIntentChange?.("paused");
      };
      const handleEnded = () => {
        clearInternalTransition();
        setIsPaused(true);
        setIsEnded(true);
        emitPlaybackState("ended");
      };
      const handleError = () => {
        clearInternalTransition();
        const assetId = activeAssetIdRef.current;
        if (assetId) {
          markFailed(assetId);
        }
      };

      video.addEventListener("loadstart", handleLoadStart);
      video.addEventListener("durationchange", handleDurationChange);
      video.addEventListener("stalled", handleStalled);
      video.addEventListener("abort", handleAbort);
      video.addEventListener("emptied", handleEmptied);
      video.addEventListener("play", handlePlay);
      video.addEventListener("playing", handlePlaying);
      video.addEventListener("pause", handlePause);
      video.addEventListener("ended", handleEnded);
      video.addEventListener("error", handleError);

      return () => {
        video.removeEventListener("loadstart", handleLoadStart);
        video.removeEventListener("durationchange", handleDurationChange);
        video.removeEventListener("stalled", handleStalled);
        video.removeEventListener("abort", handleAbort);
        video.removeEventListener("emptied", handleEmptied);
        video.removeEventListener("play", handlePlay);
        video.removeEventListener("playing", handlePlaying);
        video.removeEventListener("pause", handlePause);
        video.removeEventListener("ended", handleEnded);
        video.removeEventListener("error", handleError);
      };
    }, [clearInternalTransition, diagInstanceId, emitPlaybackState, markFailed, onPlaybackIntentChange]);

    useEffect(() => {

      return () => {
        pauseAndResetRef.current("component unmount");
      };
      // Lifecycle fix: deps intentionally empty so this only fires on genuine mount/unmount,
      // not whenever pauseAndReset's identity changes (e.g. due to displayMode/variant re-renders).
    }, []);

    const handleExpandClick = (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      onRequestExpand?.();
    };
    const handleCollapseClick = (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      onRequestCollapse?.();
    };
    const handlePreviewPlaybackClick = (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      togglePlayback();
    };

    const activeMediaLabel = previewLabel || mediaItem?.description || "Introduction video";
    const canShowPreviewExpandControl = isDeckPreview && Boolean(isExpandedMode ? onRequestCollapse : onRequestExpand);
    const assignVideoRef = useCallback((node: HTMLVideoElement | null) => {
      videoRef.current = node;

      if (node && !diagVideoElementIdRef.current) {
        diagVideoElementIdRef.current = `vid-${diagInstanceId}-${Math.random().toString(36).slice(2, 8)}`;
        node.dataset.diagVideoId = diagVideoElementIdRef.current;
      }
    }, [diagInstanceId]);

    return (
      <div className={`cloudflare-stream-player-shell${isDeckPreview ? " cloudflare-stream-player-shell--deck-preview" : ""}`}>
        <video
          ref={assignVideoRef}
          className="cloudflare-stream-player"
          style={{ visibility: displayableAssetId !== null && displayableAssetId === mediaItem?.assetId && !hasFailed ? "visible" : "hidden" }}
          controls={!isDeckPreview}
          playsInline
          preload={mediaItem ? "auto" : "none"}
          poster={posterUrl ?? undefined}
          aria-hidden={isDeckPreview ? "true" : undefined}
          aria-label={isDeckPreview ? undefined : mediaItem?.description || "Step video"}
          tabIndex={isDeckPreview ? -1 : undefined}
        />
        {isProcessing ? <p className="cloudflare-stream-player-status" role="status">Preparing video…</p> : null}
        {isPhase2MockVideo(mediaItem?.assetId) && !isDeckPreview ? <p className="cloudflare-stream-player-status">{PHASE2_MOCK_VIDEO_NOTICE}</p> : hasFailed && !isDeckPreview ? (
          <p className="cloudflare-stream-player-status">Video unavailable.</p>
        ) : null}
        {isDeckPreview ? (
          <>
            <button
              className={`deck-intro-preview-control${isPaused || isEnded ? " deck-intro-preview-control--paused" : ""}`}
              disabled={previewControlDisabled}
              onClick={handlePreviewPlaybackClick}
              type="button"
              aria-label={`${isPaused || isEnded ? "Play" : "Pause"} ${activeMediaLabel}`}
            >
              <span className="deck-intro-preview-control-icon" aria-hidden="true" />
            </button>
            {canShowPreviewExpandControl ? (
              isExpandedMode ? (
                <button
                  className="cloudflare-stream-player-frame-control cloudflare-stream-player-frame-control--exit cloudflare-stream-player-frame-control--deck-intro-close"
                  disabled={!onRequestCollapse}
                  onClick={handleCollapseClick}
                  onPointerCancel={stopPlayerControlPropagation}
                  onPointerDown={stopPlayerControlPropagation}
                  onPointerMove={stopPlayerControlPropagation}
                  onPointerUp={stopPlayerControlPropagation}
                  type="button"
                  aria-label="Exit fullscreen"
                >
                  <CollapseVideoIcon className="cloudflare-stream-player-frame-control-icon" />
                </button>
              ) : (
                <button
                  className="cloudflare-stream-player-frame-control cloudflare-stream-player-frame-control--deck-intro-expand"
                  disabled={previewControlDisabled || !onRequestExpand}
                  onClick={handleExpandClick}
                  onPointerCancel={stopPlayerControlPropagation}
                  onPointerDown={stopPlayerControlPropagation}
                  onPointerMove={stopPlayerControlPropagation}
                  onPointerUp={stopPlayerControlPropagation}
                  type="button"
                  aria-label="Expand video"
                >
                  <DeckIntroSemiExpandIcon className="cloudflare-stream-player-frame-control-icon" />
                </button>
              )
            ) : null}
          </>
        ) : !isExpandedMode && onRequestExpand ? (
          <button
            className="cloudflare-stream-player-frame-control"
            disabled={!isPlayable}
            onClick={handleExpandClick}
            onPointerCancel={stopPlayerControlPropagation}
            onPointerDown={stopPlayerControlPropagation}
            onPointerMove={stopPlayerControlPropagation}
            onPointerUp={stopPlayerControlPropagation}
            type="button"
            aria-label="Expand video"
          >
            <ExpandVideoIcon className="cloudflare-stream-player-frame-control-icon" />
          </button>
        ) : isExpandedMode && onRequestCollapse ? (
          <button
            className="cloudflare-stream-player-frame-control cloudflare-stream-player-frame-control--exit cloudflare-stream-player-frame-control--deck-intro-close"
            onClick={handleCollapseClick}
            onPointerCancel={stopPlayerControlPropagation}
            onPointerDown={stopPlayerControlPropagation}
            onPointerMove={stopPlayerControlPropagation}
            onPointerUp={stopPlayerControlPropagation}
            type="button"
            aria-label="Close enlarged video"
          >
            <CloseVideoIcon className="cloudflare-stream-player-frame-control-icon" />
          </button>
        ) : null}
      </div>
    );
  }
);

export default CloudflareHlsVideoPlayer;

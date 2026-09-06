"use client";

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
import { CollapseVideoIcon, ExpandVideoIcon } from "@/components/icons/videoControlIcons";
import { shouldRecordPlaybackPause, type VideoPlaybackIntent } from "@/components/media/videoPlaybackState";
import type { CloudflareStreamVideoMediaItem } from "@/lib/media";
import { getCloudflareStreamHlsManifestUrl, getCloudflareStreamThumbnailUrl } from "@/lib/cloudflareStreamPlayback";

export type { VideoPlaybackIntent } from "@/components/media/videoPlaybackState";

export type VideoPlaybackState = "idle" | "loading" | "playing" | "paused" | "ended" | "blocked" | "failed";

export type CloudflareHlsVideoPlayerHandle = {
  loadMedia: (mediaItem: CloudflareStreamVideoMediaItem, options?: { shouldPlay?: boolean }) => void;
  pausePlayback: (reason?: string) => void;
  pauseAndReset: (reason?: string) => void;
  togglePlayback: () => void;
};

type CloudflareHlsVideoPlayerProps = {
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
      setHasFailed(false);
      onMediaDisplayStateChange?.({ assetId, state: "renderable" });
    }, [onMediaDisplayStateChange]);

    const markFailed = useCallback((assetId: string) => {
      setIsPlayable(false);
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

    const loadMedia = useCallback((nextMediaItem: CloudflareStreamVideoMediaItem, options?: { shouldPlay?: boolean }) => {
      const video = videoRef.current;

      console.log(`[DIAG PLAYER#${diagInstanceId}] loadMedia called`, {
        assetId: nextMediaItem.assetId,
        mediaType: nextMediaItem.mediaType,
        provider: nextMediaItem.provider,
        src: nextMediaItem.src,
        shouldPlay: options?.shouldPlay ?? false,
        videoElementExists: Boolean(video),
        videoElementId: diagVideoElementIdRef.current,
      });

      if (!video) {
        console.log(`[DIAG PLAYER#${diagInstanceId}] loadMedia aborted: no native <video> element yet`);
        return;
      }

      const nextManifestUrl = getCloudflareStreamHlsManifestUrl(nextMediaItem);

      console.log(`[DIAG PLAYER#${diagInstanceId}] derived HLS manifest URL`, { manifestUrl: nextManifestUrl });

      const isSameSource =
        activeAssetIdRef.current === nextMediaItem.assetId &&
        activeManifestUrlRef.current === nextManifestUrl;
      const operationId = operationIdRef.current + 1;

      if (isSameSource) {
        console.log(`[DIAG PLAYER#${diagInstanceId}] loadMedia: same source already active`, {
          operationId,
          shouldPlay: options?.shouldPlay ?? false,
        });

        if (options?.shouldPlay) {
          operationIdRef.current = operationId;
          setIsEnded(false);
          emitPlaybackState("loading", nextMediaItem.assetId);
          requestUnmutedPlayback(video, operationId);
        }

        return;
      }

      operationIdRef.current = operationId;
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

      if (canPlayNativeHls(video)) {
        console.log(`[DIAG PLAYER#${diagInstanceId}] using native HLS playback path`, { operationId });
        video.src = nextManifestUrl;
        video.load();
      } else if (Hls.isSupported()) {
        console.log(`[DIAG PLAYER#${diagInstanceId}] using hls.js playback path`, { operationId });
        const hls = new Hls();

        hlsRef.current = hls;
        hls.on(Hls.Events.MANIFEST_LOADING, () => {
          console.log(`[DIAG PLAYER#${diagInstanceId}] hls.js MANIFEST_LOADING`, { operationId, manifestUrl: nextManifestUrl });
        });
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          console.log(`[DIAG PLAYER#${diagInstanceId}] hls.js MANIFEST_PARSED`, { operationId });
          if (isCurrentOperation(operationIdRef.current, operationId)) {
            markRenderable(nextMediaItem.assetId);
          }
        });
        hls.on(Hls.Events.ERROR, (_event, data) => {
          console.log(`[DIAG PLAYER#${diagInstanceId}] hls.js ERROR`, {
            operationId,
            fatal: data.fatal,
            type: data.type,
            details: data.details,
          });

          if (!isCurrentOperation(operationIdRef.current, operationId) || !data.fatal) {
            return;
          }

          clearInternalTransition(transitionToken);
          markFailed(nextMediaItem.assetId);
        });
        hls.attachMedia(video);
        hls.loadSource(nextManifestUrl);
      } else {
        console.log(`[DIAG PLAYER#${diagInstanceId}] using plain <video src> fallback path`, { operationId });
        video.src = nextManifestUrl;
        video.load();
      }

      console.log(`[DIAG PLAYER#${diagInstanceId}] native <video> state after source assignment`, {
        operationId,
        videoSrc: video.src,
        videoCurrentSrc: video.currentSrc,
        readyState: video.readyState,
        networkState: video.networkState,
      });

      markRenderable(nextMediaItem.assetId);

      if (options?.shouldPlay) {
        requestUnmutedPlayback(video, operationId);
      } else {
        window.setTimeout(() => clearInternalTransition(transitionToken), 0);
      }

      console.log(`[DIAG PLAYER#${diagInstanceId}] loadMedia completed`, { operationId });
    }, [
      beginInternalTransition,
      clearInternalTransition,
      destroyHls,
      markFailed,
      markRenderable,
      requestUnmutedPlayback,
      emitPlaybackState,
    ]);

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
      const video = videoRef.current;

      console.log(`[DIAG PLAYER#${diagInstanceId}] pausePlayback called`, {
        reason,
        videoExists: Boolean(video),
        videoPaused: video?.paused,
        videoEnded: video?.ended,
      });

      if (!video || video.paused || video.ended) {
        return;
      }

      video.pause();
    }, [diagInstanceId]);

    const pauseAndReset = useCallback((reason: string = "unspecified") => {
      const video = videoRef.current;

      console.log(`[DIAG PLAYER#${diagInstanceId}] pauseAndReset called`, { reason, videoExists: Boolean(video) });

      clearInternalTransition();
      destroyHls();
      operationIdRef.current += 1;
      const transitionToken = beginInternalTransition();

      activeAssetIdRef.current = null;
      activeManifestUrlRef.current = null;
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
    }, [beginInternalTransition, clearInternalTransition, destroyHls, emitPlaybackState, diagInstanceId]);

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
      console.log(`[DIAG PLAYER#${diagInstanceId}] mediaItem prop effect fired`, {
        mediaItemAssetId: mediaItem?.assetId ?? null,
        manifestUrl,
      });

      if (mediaItem) {
        loadMedia(mediaItem, { shouldPlay: false });
      }
    }, [loadMedia, mediaItem, manifestUrl, diagInstanceId]);

    useEffect(() => {
      const video = videoRef.current;

      if (!video) {
        return;
      }

      const handleLoadStart = () => {
        console.log(`[DIAG PLAYER#${diagInstanceId}] video event: loadstart`, {
          videoSrc: video.src,
          currentSrc: video.currentSrc,
          readyState: video.readyState,
          networkState: video.networkState,
        });
      };
      const handleDurationChange = () => {
        console.log(`[DIAG PLAYER#${diagInstanceId}] video event: durationchange`, { duration: video.duration });
      };
      const handleStalled = () => {
        console.log(`[DIAG PLAYER#${diagInstanceId}] video event: stalled`);
      };
      const handleAbort = () => {
        console.log(`[DIAG PLAYER#${diagInstanceId}] video event: abort`);
      };
      const handleEmptied = () => {
        console.log(`[DIAG PLAYER#${diagInstanceId}] video event: emptied`, {
          videoSrc: video.src,
          currentSrc: video.currentSrc,
        });
      };
      const handleLoadedMetadata = () => {
        console.log(`[DIAG PLAYER#${diagInstanceId}] video event: loadedmetadata`, { duration: video.duration });
        clearInternalTransition();
        const assetId = activeAssetIdRef.current;
        if (assetId) {
          markRenderable(assetId);
        }
      };
      const handleCanPlay = () => {
        console.log(`[DIAG PLAYER#${diagInstanceId}] video event: canplay`);
        clearInternalTransition();
        const assetId = activeAssetIdRef.current;
        if (assetId) {
          markRenderable(assetId);
        }
      };
      const handlePlay = () => {
        console.log(`[DIAG PLAYER#${diagInstanceId}] video event: play`);
        setIsPaused(false);
        setIsEnded(false);
        onPlaybackIntentChange?.("continue");
      };
      const handlePlaying = () => {
        console.log(`[DIAG PLAYER#${diagInstanceId}] video event: playing`);
        clearInternalTransition();
        const assetId = activeAssetIdRef.current;
        if (assetId) {
          markRenderable(assetId);
        }
        setIsPaused(false);
        setIsEnded(false);
        emitPlaybackState("playing");
        onPlaybackIntentChange?.("continue");
      };
      const handlePause = () => {
        console.log(`[DIAG PLAYER#${diagInstanceId}] video event: pause`, {
          videoEnded: video.ended,
          isInternalTransition: Boolean(internalTransitionRef.current),
        });

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
        console.log(`[DIAG PLAYER#${diagInstanceId}] video event: ended`);
        clearInternalTransition();
        setIsPaused(true);
        setIsEnded(true);
        emitPlaybackState("ended");
      };
      const handleError = () => {
        console.log(`[DIAG PLAYER#${diagInstanceId}] video event: error`, {
          errorCode: video.error?.code,
          errorMessage: video.error?.message,
        });
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
      video.addEventListener("loadedmetadata", handleLoadedMetadata);
      video.addEventListener("canplay", handleCanPlay);
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
        video.removeEventListener("loadedmetadata", handleLoadedMetadata);
        video.removeEventListener("canplay", handleCanPlay);
        video.removeEventListener("play", handlePlay);
        video.removeEventListener("playing", handlePlaying);
        video.removeEventListener("pause", handlePause);
        video.removeEventListener("ended", handleEnded);
        video.removeEventListener("error", handleError);
      };
    }, [clearInternalTransition, diagInstanceId, emitPlaybackState, markFailed, markRenderable, onPlaybackIntentChange]);

    useEffect(() => {
      console.log(`[DIAG PLAYER#${diagInstanceId}] component mounted`, { variant, displayMode });

      return () => {
        console.log(`[DIAG PLAYER#${diagInstanceId}] component unmounting, calling pauseAndReset`);
        pauseAndResetRef.current("component unmount");
      };
      // Lifecycle fix: deps intentionally empty so this only fires on genuine mount/unmount,
      // not whenever pauseAndReset's identity changes (e.g. due to displayMode/variant re-renders).
      // eslint-disable-next-line react-hooks/exhaustive-deps
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
        console.log(`[DIAG PLAYER#${diagInstanceId}] native <video> element ready`, {
          videoElementId: diagVideoElementIdRef.current,
        });
      }
    }, [diagInstanceId]);

    return (
      <div className={`cloudflare-stream-player-shell${isDeckPreview ? " cloudflare-stream-player-shell--deck-preview" : ""}`}>
        <video
          ref={assignVideoRef}
          className="cloudflare-stream-player"
          controls={!isDeckPreview}
          playsInline
          preload={mediaItem ? "metadata" : "none"}
          poster={posterUrl ?? undefined}
          aria-hidden={isDeckPreview ? "true" : undefined}
          aria-label={isDeckPreview ? undefined : mediaItem?.description || "Step video"}
          tabIndex={isDeckPreview ? -1 : undefined}
        />
        {hasFailed && !isDeckPreview ? (
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
                  className="cloudflare-stream-player-frame-control cloudflare-stream-player-frame-control--exit"
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
                  className="cloudflare-stream-player-frame-control"
                  disabled={previewControlDisabled || !onRequestExpand}
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
              )
            ) : null}
          </>
        ) : !isExpandedMode ? (
          <button
            className="cloudflare-stream-player-frame-control"
            disabled={!isPlayable || !onRequestExpand}
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
        ) : (
          <button
            className="cloudflare-stream-player-frame-control cloudflare-stream-player-frame-control--exit"
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
        )}
      </div>
    );
  }
);

export default CloudflareHlsVideoPlayer;

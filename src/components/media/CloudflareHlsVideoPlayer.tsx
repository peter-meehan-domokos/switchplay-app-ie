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
import type { CloudflareStreamVideoMediaItem } from "@/lib/media";
import { getCloudflareStreamHlsManifestUrl, getCloudflareStreamThumbnailUrl } from "@/lib/cloudflareStreamPlayback";

export type VideoPlaybackIntent = "idle" | "continue" | "paused";

export type CloudflareHlsVideoPlayerHandle = {
  loadMedia: (mediaItem: CloudflareStreamVideoMediaItem, options?: { shouldPlay?: boolean }) => void;
  pauseAndReset: () => void;
};

type CloudflareHlsVideoPlayerProps = {
  displayMode?: "embedded" | "expanded";
  mediaItem: CloudflareStreamVideoMediaItem;
  onMediaDisplayStateChange?: (state: { assetId: string; state: "failed" | "renderable" }) => void;
  onPlaybackIntentChange?: (intent: VideoPlaybackIntent) => void;
  onRequestCollapse?: () => void;
  onRequestExpand?: () => void;
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

const CloudflareHlsVideoPlayer = forwardRef<CloudflareHlsVideoPlayerHandle, CloudflareHlsVideoPlayerProps>(
  function CloudflareHlsVideoPlayer(
    {
      displayMode = "embedded",
      mediaItem,
      onMediaDisplayStateChange,
      onPlaybackIntentChange,
      onRequestCollapse,
      onRequestExpand,
    },
    ref
  ) {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const hlsRef = useRef<Hls | null>(null);
    const activeAssetIdRef = useRef<string | null>(null);
    const activeManifestUrlRef = useRef<string | null>(null);
    const operationIdRef = useRef(0);
    const internalTransitionRef = useRef<InternalTransition | null>(null);
    const [isPlayable, setIsPlayable] = useState(false);
    const [hasFailed, setHasFailed] = useState(false);
    const isExpandedMode = displayMode === "expanded";
    const manifestUrl = useMemo(() => getCloudflareStreamHlsManifestUrl(mediaItem), [mediaItem]);
    const posterUrl = useMemo(() => getCloudflareStreamThumbnailUrl(mediaItem), [mediaItem]);

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
      onMediaDisplayStateChange?.({ assetId, state: "failed" });
    }, [onMediaDisplayStateChange]);

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
            onPlaybackIntentChange?.("paused");
            console.warn("Unable to play Cloudflare Stream HLS video.", error);
          });
      }
    }, [clearInternalTransition, onPlaybackIntentChange]);

    const loadMedia = useCallback((nextMediaItem: CloudflareStreamVideoMediaItem, options?: { shouldPlay?: boolean }) => {
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

      const transitionToken = beginInternalTransition();

      destroyHls();
      activeAssetIdRef.current = nextMediaItem.assetId;
      activeManifestUrlRef.current = nextManifestUrl;
      video.pause();
      video.removeAttribute("src");
      video.load();

      if (canPlayNativeHls(video)) {
        video.src = nextManifestUrl;
        video.load();
      } else if (Hls.isSupported()) {
        const hls = new Hls();

        hlsRef.current = hls;
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (isCurrentOperation(operationIdRef.current, operationId)) {
            markRenderable(nextMediaItem.assetId);
          }
        });
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (!isCurrentOperation(operationIdRef.current, operationId) || !data.fatal) {
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

      markRenderable(nextMediaItem.assetId);

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
    ]);

    const pauseAndReset = useCallback(() => {
      const video = videoRef.current;

      clearInternalTransition();
      destroyHls();
      operationIdRef.current += 1;
      const transitionToken = beginInternalTransition();

      activeAssetIdRef.current = null;
      activeManifestUrlRef.current = null;
      setIsPlayable(false);
      setHasFailed(false);

      if (!video) {
        clearInternalTransition(transitionToken);
        return;
      }

      video.pause();
      video.removeAttribute("src");
      video.load();
      window.setTimeout(() => clearInternalTransition(transitionToken), 0);
    }, [beginInternalTransition, clearInternalTransition, destroyHls]);

    useImperativeHandle(
      ref,
      () => ({
        loadMedia,
        pauseAndReset,
      }),
      [loadMedia, pauseAndReset]
    );

    useEffect(() => {
      loadMedia(mediaItem, { shouldPlay: false });
    }, [loadMedia, mediaItem, manifestUrl]);

    useEffect(() => {
      const video = videoRef.current;

      if (!video) {
        return;
      }

      const handleLoadedMetadata = () => {
        clearInternalTransition();
        markRenderable(activeAssetIdRef.current ?? mediaItem.assetId);
      };
      const handleCanPlay = () => {
        clearInternalTransition();
        markRenderable(activeAssetIdRef.current ?? mediaItem.assetId);
      };
      const handlePlay = () => {
        onPlaybackIntentChange?.("continue");
      };
      const handlePlaying = () => {
        clearInternalTransition();
        markRenderable(activeAssetIdRef.current ?? mediaItem.assetId);
        onPlaybackIntentChange?.("continue");
      };
      const handlePause = () => {
        if (internalTransitionRef.current || video.ended) {
          return;
        }

        onPlaybackIntentChange?.("paused");
      };
      const handleEnded = () => {
        clearInternalTransition();
      };
      const handleError = () => {
        clearInternalTransition();
        markFailed(activeAssetIdRef.current ?? mediaItem.assetId);
      };

      video.addEventListener("loadedmetadata", handleLoadedMetadata);
      video.addEventListener("canplay", handleCanPlay);
      video.addEventListener("play", handlePlay);
      video.addEventListener("playing", handlePlaying);
      video.addEventListener("pause", handlePause);
      video.addEventListener("ended", handleEnded);
      video.addEventListener("error", handleError);

      return () => {
        video.removeEventListener("loadedmetadata", handleLoadedMetadata);
        video.removeEventListener("canplay", handleCanPlay);
        video.removeEventListener("play", handlePlay);
        video.removeEventListener("playing", handlePlaying);
        video.removeEventListener("pause", handlePause);
        video.removeEventListener("ended", handleEnded);
        video.removeEventListener("error", handleError);
      };
    }, [clearInternalTransition, markFailed, markRenderable, mediaItem.assetId, onPlaybackIntentChange]);

    useEffect(() => {
      return () => {
        pauseAndReset();
      };
    }, [pauseAndReset]);

    const handleExpandClick = (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      onRequestExpand?.();
    };
    const handleCollapseClick = (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      onRequestCollapse?.();
    };

    return (
      <div className="cloudflare-stream-player-shell">
        <video
          ref={videoRef}
          className="cloudflare-stream-player"
          controls
          playsInline
          preload="metadata"
          poster={posterUrl}
          aria-label={mediaItem.description || "Step video"}
        />
        {hasFailed ? (
          <p className="cloudflare-stream-player-status">Video unavailable.</p>
        ) : null}
        {!isExpandedMode ? (
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

import type { CloudflareStreamVideoMediaItem } from "@/lib/media";
import { useEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent } from "react";

const CLOUDFLARE_STREAM_SDK_SRC = "https://embed.cloudflarestream.com/embed/sdk.latest.js";

type CloudflareStreamPlayerInstance = {
  addEventListener?: (eventName: string, listener: () => void) => void;
  controls?: boolean;
  ended?: boolean;
  pause?: () => void;
  paused?: boolean;
  play?: () => Promise<void> | void;
  removeEventListener?: (eventName: string, listener: () => void) => void;
};

declare global {
  interface Window {
    Stream?: (iframe: HTMLIFrameElement) => CloudflareStreamPlayerInstance;
  }
}

type CloudflareStreamPlayerProps = {
  controlsMode?: "native" | "switchplay";
  displayMode?: "embedded" | "expanded";
  mediaItem: CloudflareStreamVideoMediaItem;
  onMediaDisplayStateChange?: (state: { assetId: string; state: "failed" | "renderable" }) => void;
  onRequestCollapse?: () => void;
  onRequestExpand?: () => void;
};

let cloudflareStreamSdkPromise: Promise<void> | null = null;

function createCloudflareStreamIframeUrl(assetId: string) {
  return `https://iframe.videodelivery.net/${encodeURIComponent(assetId)}`;
}

function createCloudflareStreamThumbnailUrl(assetId: string) {
  return `https://videodelivery.net/${encodeURIComponent(assetId)}/thumbnails/thumbnail.jpg`;
}

function isValidCloudflareStreamIframeUrl(value: string) {
  try {
    const url = new URL(value);

    return url.protocol === "https:" && url.hostname === "iframe.videodelivery.net";
  } catch {
    return false;
  }
}

function isValidCloudflareStreamThumbnailUrl(value: string) {
  try {
    const url = new URL(value);

    return url.protocol === "https:";
  } catch {
    return false;
  }
}

export function getCloudflareStreamIframeUrl(mediaItem: CloudflareStreamVideoMediaItem) {
  return isValidCloudflareStreamIframeUrl(mediaItem.src)
    ? mediaItem.src
    : createCloudflareStreamIframeUrl(mediaItem.assetId);
}

function getCloudflareStreamIframeUrlWithControls(mediaItem: CloudflareStreamVideoMediaItem, controls: boolean) {
  const iframeUrl = getCloudflareStreamIframeUrl(mediaItem);
  const url = new URL(iframeUrl);

  url.searchParams.set("controls", controls ? "true" : "false");

  return url.toString();
}

export function getCloudflareStreamThumbnailUrl(mediaItem: CloudflareStreamVideoMediaItem) {
  return mediaItem.thumbnailSrc && isValidCloudflareStreamThumbnailUrl(mediaItem.thumbnailSrc)
    ? mediaItem.thumbnailSrc
    : createCloudflareStreamThumbnailUrl(mediaItem.assetId);
}

function loadCloudflareStreamSdk() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Cloudflare Stream SDK requires a browser."));
  }

  if (window.Stream) {
    return Promise.resolve();
  }

  if (cloudflareStreamSdkPromise) {
    return cloudflareStreamSdkPromise;
  }

  cloudflareStreamSdkPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${CLOUDFLARE_STREAM_SDK_SRC}"]`);

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Unable to load Cloudflare Stream SDK.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.async = true;
    script.src = CLOUDFLARE_STREAM_SDK_SRC;
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error("Unable to load Cloudflare Stream SDK.")), { once: true });
    document.head.appendChild(script);
  });

  return cloudflareStreamSdkPromise;
}

function stopPlayerControlPropagation(event: PointerEvent<HTMLButtonElement>) {
  event.stopPropagation();
}

export default function CloudflareStreamPlayer({
  controlsMode = "native",
  displayMode = "embedded",
  mediaItem,
  onMediaDisplayStateChange,
  onRequestCollapse,
  onRequestExpand,
}: CloudflareStreamPlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const playerRef = useRef<CloudflareStreamPlayerInstance | null>(null);
  const [isPaused, setIsPaused] = useState(true);
  const [isEnded, setIsEnded] = useState(false);
  const [sdkStatus, setSdkStatus] = useState<"idle" | "ready" | "failed">("idle");
  const isSwitchplayControlsMode = controlsMode === "switchplay";
  const isExpandedMode = displayMode === "expanded";
  const iframeSrc = useMemo(
    () =>
      isSwitchplayControlsMode && sdkStatus !== "failed"
        ? getCloudflareStreamIframeUrlWithControls(mediaItem, false)
        : getCloudflareStreamIframeUrl(mediaItem),
    [isSwitchplayControlsMode, mediaItem, sdkStatus]
  );
  const iframeTitle = mediaItem.description || "Step video";

  useEffect(() => {
    if (!isSwitchplayControlsMode) {
      return;
    }

    const iframe = iframeRef.current;

    if (!iframe) {
      return;
    }

    let isCancelled = false;
    let player: CloudflareStreamPlayerInstance | null = null;
    const emitRenderable = () => {
      onMediaDisplayStateChange?.({ assetId: mediaItem.assetId, state: "renderable" });
    };
    const emitFailed = () => {
      onMediaDisplayStateChange?.({ assetId: mediaItem.assetId, state: "failed" });
    };
    const syncPausedState = () => {
      if (!player) {
        return;
      }

      setIsPaused(Boolean(player.paused));
      setIsEnded(Boolean(player.ended));
    };
    const handlePlay = () => {
      setIsPaused(false);
      setIsEnded(false);
    };
    const handlePause = () => {
      setIsPaused(true);
    };
    const handleEnded = () => {
      setIsPaused(true);
      setIsEnded(true);
    };
    const handleRuntimeMediaError = () => {
      // Runtime media errors can be transient (for example during startup buffering).
      // Keep Switchplay controls active unless SDK/bootstrap initialization fails.
      console.warn("Cloudflare Stream emitted a runtime media error; retaining Switchplay controls.");
    };

    setSdkStatus("idle");

    loadCloudflareStreamSdk()
      .then(() => {
        if (isCancelled) {
          return;
        }

        if (!window.Stream) {
          setSdkStatus("failed");
          emitFailed();
          return;
        }

        player = window.Stream(iframe);
        if (!player) {
          setSdkStatus("failed");
          emitFailed();
          return;
        }
        player.controls = false;
        playerRef.current = player;
        player.addEventListener?.("loadedmetadata", emitRenderable);
        player.addEventListener?.("canplay", emitRenderable);
        player.addEventListener?.("playing", emitRenderable);
        player.addEventListener?.("play", handlePlay);
        player.addEventListener?.("playing", handlePlay);
        player.addEventListener?.("pause", handlePause);
        player.addEventListener?.("ended", handleEnded);
        player.addEventListener?.("error", handleRuntimeMediaError);
        syncPausedState();
        setSdkStatus("ready");
      })
      .catch((error) => {
        console.warn("Unable to initialize Cloudflare Stream SDK.", error);
        if (!isCancelled) {
          setSdkStatus("failed");
          emitFailed();
        }
      });

    return () => {
      isCancelled = true;
      player?.removeEventListener?.("loadedmetadata", emitRenderable);
      player?.removeEventListener?.("canplay", emitRenderable);
      player?.removeEventListener?.("playing", emitRenderable);
      player?.removeEventListener?.("play", handlePlay);
      player?.removeEventListener?.("playing", handlePlay);
      player?.removeEventListener?.("pause", handlePause);
      player?.removeEventListener?.("ended", handleEnded);
      player?.removeEventListener?.("error", handleRuntimeMediaError);
      if (playerRef.current === player) {
        playerRef.current = null;
      }
    };
  }, [isSwitchplayControlsMode, mediaItem.assetId, mediaItem.src]);

  useEffect(() => {
    if (!isSwitchplayControlsMode || sdkStatus !== "ready") {
      return;
    }

    if (!playerRef.current) {
      return;
    }

    playerRef.current.controls = false;
  }, [isSwitchplayControlsMode, sdkStatus, displayMode]);

  const togglePlayback = () => {
    const player = playerRef.current;

    if (!player || sdkStatus !== "ready") {
      return;
    }

    if (isPaused || isEnded) {
      const playResult = player.play?.();

      if (playResult instanceof Promise) {
        void playResult.catch((error) => {
          console.warn("Unable to play Cloudflare Stream video.", error);
          setIsPaused(true);
        });
      }

      return;
    }

    player.pause?.();
  };
  const handleExpandClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!onRequestExpand) {
      return;
    }

    onRequestExpand();
  };
  const handleCollapseClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!onRequestCollapse) {
      return;
    }

    onRequestCollapse();
  };

  if (isSwitchplayControlsMode) {
    const hasSdkFailed = sdkStatus === "failed";
    const buttonLabel = isPaused || isEnded ? "Play video" : "Pause video";

    return (
      <div className="cloudflare-stream-player-shell">
        <iframe
          ref={iframeRef}
          className="cloudflare-stream-player"
          src={iframeSrc}
          title={iframeTitle}
          onLoad={() => {
            onMediaDisplayStateChange?.({ assetId: mediaItem.assetId, state: "renderable" });
          }}
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          loading="lazy"
        />
        {hasSdkFailed ? (
          <p className="cloudflare-stream-player-status">Native video controls restored.</p>
        ) : (
          <>
            {!isExpandedMode ? (
              <button
                className="cloudflare-stream-player-frame-control"
                disabled={sdkStatus !== "ready" || !onRequestExpand}
                onClick={handleExpandClick}
                onPointerCancel={stopPlayerControlPropagation}
                onPointerDown={stopPlayerControlPropagation}
                onPointerMove={stopPlayerControlPropagation}
                onPointerUp={stopPlayerControlPropagation}
                type="button"
                aria-label="Expand video"
              >
                <span className="cloudflare-stream-player-frame-control-icon" aria-hidden="true" />
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
                <span
                  className="cloudflare-stream-player-frame-control-icon cloudflare-stream-player-frame-control-icon--exit"
                  aria-hidden="true"
                />
              </button>
            )}
            <button
              className="cloudflare-stream-player-control"
              disabled={sdkStatus !== "ready"}
              onClick={togglePlayback}
              onPointerCancel={stopPlayerControlPropagation}
              onPointerDown={stopPlayerControlPropagation}
              onPointerMove={stopPlayerControlPropagation}
              onPointerUp={stopPlayerControlPropagation}
              type="button"
              aria-label={buttonLabel}
            >
              {isPaused || isEnded ? "Play" : "Pause"}
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <iframe
      ref={iframeRef}
      className="cloudflare-stream-player"
      src={iframeSrc}
      title={iframeTitle}
      allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
      allowFullScreen
      loading="lazy"
    />
  );
}

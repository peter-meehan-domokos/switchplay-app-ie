"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import CloudflareHlsVideoPlayer, { type CloudflareHlsVideoPlayerHandle, type VideoPlaybackState } from "./CloudflareHlsVideoPlayer";
import { startStreamVideoReadinessPolling, type StreamVideoReadinessState } from "./useStreamVideoReadiness";
import { requestCardVideoReadiness } from "@/lib/cardMediaClient";
import type { CardMediaRequest } from "@/lib/cardMediaViewer";
import type { VideoMediaItem } from "@/lib/media";
import { getCloudflareStreamThumbnailUrl } from "@/lib/cloudflareStreamPlayback";
import styles from "./CardMediaViewer.module.css";

export type ViewerVideoHandle = { stop: () => void };
const CardMediaViewerVideo = forwardRef<ViewerVideoHandle, { item: VideoMediaItem; target: CardMediaRequest }>(function CardMediaViewerVideo({ item, target }, ref) {
  const player = useRef<CloudflareHlsVideoPlayerHandle>(null);
  const container = useRef<HTMLDivElement>(null);
  const [readiness, setReadiness] = useState<StreamVideoReadinessState>({ status: "checking" });
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [frameVisible, setFrameVisible] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);
  const { viewerUserId, cardTemplateId, sourceCardTemplateId, mediaItemId } = target;
  const [grant, setGrant] = useState<import("@/lib/cardPlaybackGrants").PlaybackGrant | null>(null);
  const resolvePlayback = useCallback(async (_item: unknown, signal: AbortSignal) => {
    if (signal.aborted || !grant || grant.assetId !== item.assetId || Date.now() >= grant.expiresAt - 30_000) throw new Error("Video authorization expired. Retry video.");
    return grant;
  }, [grant, item.assetId]);

  const stop = useCallback(() => {
    player.current?.pauseAndReset("card media viewer leaving video");
    const video = container.current?.querySelector("video");
    if (video) { video.pause(); video.removeAttribute("src"); video.load(); }
  }, []);
  useImperativeHandle(ref, () => ({ stop }), [stop]);

  useEffect(() => startStreamVideoReadinessPolling({ scope: "user-card", deckTemplateId: "personal-media-viewer", cardId: cardTemplateId }, item.assetId, setReadiness, {
    requestStatus: async (_target, _assetId, signal) => {
      try { const result = await requestCardVideoReadiness({ viewerUserId, cardTemplateId, sourceCardTemplateId, mediaItemId }, signal);
        if (!signal.aborted && result.status === "ready") {
          if (!result.grant || result.grant.assetId !== item.assetId) throw new Error("Video authorization unavailable.");
          setGrant(result.grant); setPosterFailed(false);
        }
        return result; }
      catch (failure) { if (!signal.aborted) setError(failure instanceof Error ? failure.message : "Unable to check video status."); throw failure; }
    },
  }), [attempt, cardTemplateId, sourceCardTemplateId, viewerUserId, item.assetId, mediaItemId]);

  useLayoutEffect(() => {
    if (readiness.status !== "ready") return;
    // Layout cleanup still has access to the native node, before React clears refs.
    const video = container.current?.querySelector("video");
    const handle = player.current;
    return () => {
      handle?.pauseAndReset("card media viewer unmount");
      if (video) { video.pause(); video.removeAttribute("src"); video.load(); }
    };
  }, [readiness.status, attempt]);

  useEffect(() => {
    if (readiness.status !== "ready" || !loading) return;
    const timer = setTimeout(() => { setLoading(false); setError("The video is taking longer than expected to load. Please retry."); }, 20_000);
    return () => clearTimeout(timer);
  }, [loading, readiness.status]);

  const frameChanged = useCallback(({ assetId, state }: { assetId: string; state: "failed" | "decoded" | "renderable" }) => {
    if (assetId !== item.assetId) return;
    if (state === "renderable") { setFrameVisible(true); setLoading(false); }
    if (state === "failed") { setFrameVisible(false); setError("The video could not be played. Please retry."); setLoading(false); }
  }, [item.assetId]);
  const playbackChanged = useCallback(({ state }: { state: VideoPlaybackState }) => {
    if (state === "failed") { setError("The video could not be played. Please retry."); setLoading(false); }
    if (state === "blocked") { setError("Playback was blocked. Tap the video play control to try again."); setLoading(false); }
  }, []);
  const retry = () => { stop(); setReadiness({ status: "checking" }); setGrant(null); setError(null); setLoading(true); setFrameVisible(false); setPosterFailed(false); setAttempt((value) => value + 1); };
  const failed = readiness.status === "failed" || readiness.status === "unavailable" || readiness.status === "waiting";
  if (item.provider !== "cloudflare-stream") return <div className={styles.mediaStatus} role="alert">This video provider is unavailable in the personal media viewer.</div>;
  return <div className={styles.videoArea} ref={container}
    onLoadedMetadataCapture={() => { setLoading(false); setError(null); }}
    onCanPlayCapture={() => { setLoading(false); setError(null); }}
    onWaitingCapture={() => setLoading(true)} onPlayingCapture={() => { setLoading(false); setError(null); }} onPauseCapture={() => setLoading(false)}>
    {readiness.status === "ready" ? <CloudflareHlsVideoPlayer key={`${item.id}:${attempt}`} ref={player} mediaItem={item} resolvePlayback={resolvePlayback} externalLoadingPresentation onMediaDisplayStateChange={frameChanged} onPlaybackStateChange={playbackChanged} /> : <>
      <div className={styles.mediaStatus} role={failed ? "alert" : "status"}>
        <p>{error || (readiness.status === "failed" ? "Video processing failed." : readiness.status === "waiting" ? "Video is still processing. Check again shortly." : readiness.status === "checking" ? "Checking video…" : "Processing video…")}</p>
        {failed ? <button className={styles.control} type="button" onClick={retry}>Retry video</button> : null}
      </div>
    </>}
    {!frameVisible && !posterFailed ? /* eslint-disable-next-line @next/next/no-img-element */
      <img className={styles.poster} src={grant?.thumbnailUrl ?? getCloudflareStreamThumbnailUrl(item)} alt="" onError={() => setPosterFailed(true)} /> : null}
    {readiness.status === "ready" && (loading || error || (!frameVisible && posterFailed)) ? <div className={styles.videoStatus} role={error ? "alert" : "status"}>
      <span>{error || "Loading video…"}</span>{error ? <button className={styles.control} type="button" onClick={retry}>Retry video</button> : null}
    </div> : null}
  </div>;
});
export default CardMediaViewerVideo;

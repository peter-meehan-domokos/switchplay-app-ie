"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import CloudflareHlsVideoPlayer, { type CloudflareHlsVideoPlayerHandle, type VideoPlaybackState } from "./CloudflareHlsVideoPlayer";
import { startStreamVideoReadinessPolling, type StreamVideoReadinessState } from "./useStreamVideoReadiness";
import { requestCardVideoReadiness } from "@/lib/cardMediaClient";
import type { CardMediaRequest } from "@/lib/cardMediaViewer";
import type { CloudflareStreamVideoMediaItem } from "@/lib/media";
import { getCloudflareStreamThumbnailUrl } from "@/lib/cloudflareStreamPlayback";
import styles from "./CardMediaViewer.module.css";

export type ViewerVideoHandle = { stop: () => void };
const CardMediaViewerVideo = forwardRef<ViewerVideoHandle, { item: CloudflareStreamVideoMediaItem; target: CardMediaRequest }>(function CardMediaViewerVideo({ item, target }, ref) {
  const player = useRef<CloudflareHlsVideoPlayerHandle>(null);
  const container = useRef<HTMLDivElement>(null);
  const [readiness, setReadiness] = useState<StreamVideoReadinessState>({ status: "checking" });
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [posterFailed, setPosterFailed] = useState(false);
  const { deckUserId, deckTemplateId, cardId, mediaItemId } = target;

  const stop = useCallback(() => {
    player.current?.pauseAndReset("card media viewer leaving video");
    const video = container.current?.querySelector("video");
    if (video) { video.pause(); video.removeAttribute("src"); video.load(); }
  }, []);
  useImperativeHandle(ref, () => ({ stop }), [stop]);

  useEffect(() => startStreamVideoReadinessPolling({ scope: "user-card", deckTemplateId, cardId }, item.assetId, setReadiness, {
    requestStatus: async (_target, _assetId, signal) => {
      try { return await requestCardVideoReadiness({ deckUserId, deckTemplateId, cardId, mediaItemId }, signal); }
      catch (failure) { if (!signal.aborted) setError(failure instanceof Error ? failure.message : "Unable to check video status."); throw failure; }
    },
  }), [attempt, cardId, deckTemplateId, deckUserId, item.assetId, mediaItemId]);

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

  const playbackChanged = useCallback(({ state }: { state: VideoPlaybackState }) => {
    if (state === "failed") { setError("The video could not be played. Please retry."); setLoading(false); }
    if (state === "blocked") { setError("Playback was blocked. Tap the video play control to try again."); setLoading(false); }
  }, []);
  const retry = () => { stop(); setReadiness({ status: "checking" }); setError(null); setLoading(true); setPosterFailed(false); setAttempt((value) => value + 1); };
  const failed = readiness.status === "failed" || readiness.status === "unavailable" || readiness.status === "waiting";
  return <div className={styles.videoArea} ref={container}
    onLoadedMetadataCapture={() => { setLoading(false); setError(null); }}
    onCanPlayCapture={() => { setLoading(false); setError(null); }}
    onWaitingCapture={() => setLoading(true)} onPlayingCapture={() => { setLoading(false); setError(null); }} onPauseCapture={() => setLoading(false)}>
    {readiness.status === "ready" ? <CloudflareHlsVideoPlayer key={`${item.id}:${attempt}`} ref={player} mediaItem={item} onPlaybackStateChange={playbackChanged} /> : <>
      {!posterFailed ? /* eslint-disable-next-line @next/next/no-img-element */
        <img className={styles.poster} src={getCloudflareStreamThumbnailUrl(item)} alt="" onError={() => setPosterFailed(true)} /> : null}
      <div className={styles.mediaStatus} role={failed ? "alert" : "status"}>
        <p>{error || (readiness.status === "failed" ? "Video processing failed." : readiness.status === "waiting" ? "Video is still processing. Check again shortly." : readiness.status === "checking" ? "Checking video…" : "Processing video…")}</p>
        {failed ? <button className={styles.control} type="button" onClick={retry}>Retry video</button> : null}
      </div>
    </>}
    {readiness.status === "ready" && (loading || error) ? <div className={styles.videoStatus} role={error ? "alert" : "status"}>
      <span>{error || "Loading video…"}</span>{error ? <button className={styles.control} type="button" onClick={retry}>Retry video</button> : null}
    </div> : null}
  </div>;
});
export default CardMediaViewerVideo;

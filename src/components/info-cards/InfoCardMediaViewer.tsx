"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import CardMediaViewerImage from "@/components/media/CardMediaViewerImage";
import CloudflareHlsVideoPlayer, { type CloudflareHlsVideoPlayerHandle } from "@/components/media/CloudflareHlsVideoPlayer";
import type { ImageMediaItem, CloudflareStreamVideoMediaItem } from "@/lib/media";
import type { PlaybackGrant } from "@/lib/cardPlaybackGrants";
import { containInfoCardFocus, isolateInfoCardEvent, useInfoCardDialog } from "./useInfoCardDialog";
import styles from "./InfoCardConsultation.module.css";
import mediaStyles from "@/components/media/CardMediaViewer.module.css";

export type InfoCardMedia = ImageMediaItem | CloudflareStreamVideoMediaItem;
const noNavigation = () => {};

export default function InfoCardMediaViewer({ media, onClose, imageSrc, resolvePlayback, returnFocus }: { media: InfoCardMedia; onClose: () => void; returnFocus?: HTMLElement;
  imageSrc?: string; resolvePlayback?: (item: CloudflareStreamVideoMediaItem, signal: AbortSignal) => Promise<PlaybackGrant> }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const player = useRef<CloudflareHlsVideoPlayerHandle>(null);
  useInfoCardDialog(dialog, closeButton, returnFocus);
  // Portrait videos otherwise sit in a viewer-sized box and are painted with near-black bands above and below.
  // Size the video box to the video's own ratio: stored dimensions if present, else the video's metadata.
  const stored = media.mediaType === "video" && media.width && media.height ? media.width / media.height : null;
  const [measured, setMeasured] = useState<{ assetId: string; ratio: number } | null>(null);
  const videoBox = useRef<HTMLDivElement>(null);
  const assetId = media.mediaType === "video" ? media.assetId : "";
  useEffect(() => {
    const box = videoBox.current;
    if (!box || stored) return;
    // loadedmetadata does not bubble, so listen in the capture phase from the wrapper.
    const onMetadata = (event: Event) => {
      const video = event.target as HTMLVideoElement;
      if (video.videoWidth > 0 && video.videoHeight > 0) setMeasured({ assetId, ratio: video.videoWidth / video.videoHeight });
    };
    box.addEventListener("loadedmetadata", onMetadata, true);
    return () => box.removeEventListener("loadedmetadata", onMetadata, true);
  }, [stored, assetId]);
  const ratio = stored ?? (measured && measured.assetId === assetId ? measured.ratio : null);
  const close = () => { player.current?.pausePlayback("info media close"); onClose(); };
  const fullscreen = () => Boolean(document.fullscreenElement ||
    (dialog.current?.querySelector("video") as (HTMLVideoElement & { webkitDisplayingFullscreen?: boolean }) | null)?.webkitDisplayingFullscreen);

  return createPortal(<dialog ref={dialog} tabIndex={-1} className={`${styles.dialog} ${styles.mediaViewer}`} aria-label="Info card media" aria-modal="true"
    onClick={isolateInfoCardEvent} onPointerDown={isolateInfoCardEvent} onPointerMove={isolateInfoCardEvent}
    onPointerUp={isolateInfoCardEvent} onPointerCancel={isolateInfoCardEvent} onWheel={isolateInfoCardEvent}
    onKeyDown={event => {
      containInfoCardFocus(event);
      if (event.key === "Escape" && !fullscreen()) { event.preventDefault(); close(); }
    }} onKeyUp={isolateInfoCardEvent}
    onCancel={event => { event.preventDefault(); if (!fullscreen()) close(); }}>
    <header className={styles.toolbar}>
      <button ref={closeButton} className={styles.mediaClose} type="button" onClick={close} aria-label="Close info card media">×</button>
    </header>
    <div className={media.mediaType === "video" ? `${styles.mediaContent} ${styles.videoHost}` : styles.mediaContent}>
      {media.mediaType === "image" ? <CardMediaViewerImage item={media} onNavigate={noNavigation} deliverySrc={imageSrc} /> :
        <div ref={videoBox} className={ratio ? styles.videoFit : styles.videoFill} data-info-video-ratio={ratio ?? undefined} style={ratio ? { "--video-ratio": ratio } as React.CSSProperties : undefined}>
          <div className={mediaStyles.videoArea}><CloudflareHlsVideoPlayer ref={player} mediaItem={media} resolvePlayback={resolvePlayback} /></div>
        </div>}
    </div>
  </dialog>, document.body);
}

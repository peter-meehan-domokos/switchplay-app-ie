"use client";

import { useRef } from "react";
import { createPortal } from "react-dom";
import CardMediaViewerImage from "@/components/media/CardMediaViewerImage";
import CloudflareHlsVideoPlayer, { type CloudflareHlsVideoPlayerHandle } from "@/components/media/CloudflareHlsVideoPlayer";
import type { ImageMediaItem, CloudflareStreamVideoMediaItem } from "@/lib/media";
import { containInfoCardFocus, isolateInfoCardEvent, useInfoCardDialog } from "./useInfoCardDialog";
import styles from "./InfoCardConsultation.module.css";
import mediaStyles from "@/components/media/CardMediaViewer.module.css";

export type InfoCardMedia = ImageMediaItem | CloudflareStreamVideoMediaItem;
const noNavigation = () => {};

export default function InfoCardMediaViewer({ media, onClose }: { media: InfoCardMedia; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const player = useRef<CloudflareHlsVideoPlayerHandle>(null);
  useInfoCardDialog(dialog, closeButton);
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
    <div className={styles.mediaContent}>
      {media.mediaType === "image" ? <CardMediaViewerImage item={media} onNavigate={noNavigation} /> :
        <div className={mediaStyles.videoArea}><CloudflareHlsVideoPlayer ref={player} mediaItem={media} /></div>}
    </div>
  </dialog>, document.body);
}

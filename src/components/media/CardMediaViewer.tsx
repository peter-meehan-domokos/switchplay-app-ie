"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject, type SyntheticEvent } from "react";
import { createPortal } from "react-dom";
import { useIsPresent } from "motion/react";
import type { ModernUserCardMediaItem } from "@/lib/userCardMedia";
import type { CardMediaTarget } from "@/lib/cardMediaViewer";
import CardMediaViewerImage from "./CardMediaViewerImage";
import CardMediaViewerVideo, { type ViewerVideoHandle } from "./CardMediaViewerVideo";
import CardMediaDownloadButton from "./CardMediaDownloadButton";
import styles from "./CardMediaViewer.module.css";

type Props = {
  items: ModernUserCardMediaItem[];
  index: number;
  target: CardMediaTarget;
  sourceRef: RefObject<HTMLButtonElement | null>;
  backgroundRef: RefObject<HTMLElement | null>;
  onSelect: (mediaItemId: string, index: number) => void;
  onClose: () => void;
};
const isolate = (event: SyntheticEvent) => event.stopPropagation();

export default function CardMediaViewer({ items, index, target, sourceRef, backgroundRef, onSelect, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const video = useRef<ViewerVideoHandle>(null);
  const [closing, setClosing] = useState(false);
  const isPresent = useIsPresent();
  const item = items[index];
  const leaving = closing || !item || !isPresent;
  const stop = useCallback(() => video.current?.stop(), []);
  const close = () => { stop(); setClosing(true); };
  const isVideoFullscreen = () => Boolean(document.fullscreenElement ||
    (dialog.current?.querySelector("video") as (HTMLVideoElement & { webkitDisplayingFullscreen?: boolean }) | null)?.webkitDisplayingFullscreen);
  const navigate = (direction: -1 | 1) => {
    const nextIndex = Math.min(items.length - 1, Math.max(0, index + direction));
    if (nextIndex !== index && !leaving) { stop(); onSelect(items[nextIndex].id, nextIndex); }
  };

  useLayoutEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const background = backgroundRef.current?.closest<HTMLElement>(".app-shell") ?? backgroundRef.current;
    const wasInert = background?.inert;
    const originalSource = sourceRef.current;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const savedStyles = [document.documentElement, document.body].map((node) => ({ node, overflow: node.style.getPropertyValue("overflow"), priority: node.style.getPropertyPriority("overflow") }));
    savedStyles.forEach(({ node }) => node.style.setProperty("overflow", "hidden"));
    element.showModal();
    closeButton.current?.focus({ preventScroll: true });
    background?.setAttribute("inert", "");
    return () => {
      element.close();
      if (background && !wasInert) background.removeAttribute("inert");
      savedStyles.forEach(({ node, overflow, priority }) => overflow ? node.style.setProperty("overflow", overflow, priority) : node.style.removeProperty("overflow"));
      if (window.scrollX !== scrollX || window.scrollY !== scrollY) window.scrollTo(scrollX, scrollY);
      const visible = (node: HTMLElement | null | undefined) => node?.isConnected && !node.closest("[inert]") && node.getClientRects().length;
      const fallback = background?.querySelector<HTMLElement>(".focused-card-scrim") ?? background?.querySelector<HTMLElement>(".deck-back-overlay");
      if (visible(originalSource)) originalSource?.focus({ preventScroll: true });
      else if (visible(fallback)) fallback?.focus({ preventScroll: true });
    };
  }, [backgroundRef, sourceRef]);

  useEffect(() => {
    if (!leaving) return;
    const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 200;
    const timer = setTimeout(onClose, delay);
    return () => clearTimeout(timer);
  }, [leaving, onClose]);

  if (typeof document === "undefined") return null;
  return createPortal(<dialog ref={dialog} aria-label="Card media viewer" aria-modal="true" className={`${styles.viewer}${leaving ? ` ${styles.closing}` : ""}`}
    onCancel={(event) => { event.preventDefault(); if (!isVideoFullscreen()) close(); }}
    onClick={isolate} onPointerDown={isolate} onPointerMove={isolate} onPointerUp={isolate} onPointerCancel={isolate}
    onKeyDown={(event) => {
      event.stopPropagation();
      const node = event.target as HTMLElement;
      if (event.key === "Tab") {
        const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>("button:not(:disabled), a[href], video[controls], [tabindex]:not([tabindex='-1'])") ?? [])
          .filter((control) => control.getClientRects().length > 0 && !control.closest("[inert]"));
        const first = controls[0];
        const last = controls.at(-1);
        if (event.shiftKey && node === first && last) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && node === last && first) { event.preventDefault(); first.focus(); }
        return;
      }
      if (event.key === "Escape" && !isVideoFullscreen()) { event.preventDefault(); close(); }
      if (event.altKey || event.ctrlKey || event.metaKey || node.closest("video, input, textarea, select, [role=slider]")) return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); navigate(event.key === "ArrowLeft" ? -1 : 1); }
    }}>
    <header className={styles.toolbar}>
      <button ref={closeButton} className={styles.control} type="button" onClick={close} aria-label="Close media viewer">✕ <span>Close</span></button>
      <p className={styles.counter} aria-live="polite" aria-atomic="true">{index + 1} of {items.length}</p>
      {!leaving && item ? <CardMediaDownloadButton key={item.id} target={{ ...target, mediaItemId: item.id }} isVideo={item.mediaType === "video"} /> : <span />}
    </header>
    <div className={styles.content}>
      {!leaving && item ? item.mediaType === "image" ? <CardMediaViewerImage key={item.id} item={item} onNavigate={navigate} /> :
        <CardMediaViewerVideo key={item.id} ref={video} item={item} target={{ ...target, mediaItemId: item.id }} /> : null}
    </div>
    {items.length > 1 ? <nav className={styles.navigation} aria-label="Media navigation">
      <button className={styles.control} type="button" disabled={leaving || index === 0} onClick={() => navigate(-1)} aria-label="Previous media">← Previous</button>
      <button className={styles.control} type="button" disabled={leaving || index === items.length - 1} onClick={() => navigate(1)} aria-label="Next media">Next →</button>
    </nav> : null}
  </dialog>, document.body);
}

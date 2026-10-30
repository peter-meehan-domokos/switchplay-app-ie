"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { instructionalImageUrl, readInstructionalImageContext, type InstructionalImageContext } from "@/lib/instructionalImageContext";
import type { InstructionalImageResources } from "@/lib/instructionalImageResources";
import CardMediaViewerImage from "@/components/media/CardMediaViewerImage";
import { ExpandVideoIcon } from "@/components/icons/videoControlIcons";
import viewerStyles from "@/components/media/CardMediaViewer.module.css";
import styles from "./StepView.module.css";

const noNavigation = () => {};
function ExpandedImage({ src, alt, onClose, returnFocus }: { src: string; alt: string; onClose: () => void; returnFocus: HTMLElement }) {
  const dialog = useRef<HTMLDialogElement>(null), close = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    const element = dialog.current!, overflow = document.body.style.overflow;
    element.showModal(); document.body.style.overflow = "hidden"; close.current?.focus({ preventScroll: true });
    return () => { element.close(); document.body.style.overflow = overflow; if (returnFocus.isConnected) returnFocus.focus({ preventScroll: true }); };
  }, [returnFocus]);
  return createPortal(<dialog ref={dialog} className={viewerStyles.viewer} aria-label="Expanded instructional image" aria-modal="true"
    onCancel={event => { event.preventDefault(); onClose(); }} onKeyDown={event => event.stopPropagation()}
    onClick={event => event.stopPropagation()} onPointerDown={event => event.stopPropagation()} onPointerUp={event => event.stopPropagation()}>
    <header className={viewerStyles.toolbar}><button ref={close} className={viewerStyles.control} type="button" onClick={onClose} aria-label="Close expanded image">Close</button></header>
    <div className={viewerStyles.content}><CardMediaViewerImage item={{ id: "instructional-image", mediaType: "image", src, description: alt }} deliverySrc={src} onNavigate={noNavigation} /></div>
  </dialog>, document.body);
}

export default function InstructionalImage({ context, alt, resources }: { context?: InstructionalImageContext; alt: string; resources: InstructionalImageResources }) {
  const identity = context ? instructionalImageUrl(context) : undefined;
  const [result, setResult] = useState<{ identity: string; src?: string; failed?: boolean }>(), [attempt, setAttempt] = useState(0);
  const [decoded, setDecoded] = useState<string>(), [expanded, setExpanded] = useState<{ src: string; source: HTMLElement }>();
  useEffect(() => {
    if (!identity) return;
    // Identity contains every context field. Reconstruct it inside the effect so
    // unrelated parent animation renders never restart a request or its lease.
    const request = readInstructionalImageContext(new URLSearchParams(identity.split("?")[1]));
    if (!request) return;
    let active = true, lease: ReturnType<InstructionalImageResources["acquire"]> | undefined;
    try {
      lease = resources.acquire(request);
      void lease.ready.then(src => { if (active) setResult({ identity, src }); }, () => { if (active) setResult({ identity, failed: true }); });
    } catch { queueMicrotask(() => { if (active) setResult({ identity, failed: true }); }); }
    return () => { active = false; lease?.release(); };
  }, [identity, resources, attempt]);
  const current = result?.identity === identity ? result : undefined;
  if (!context || current?.failed) return <div role="status"><p>Image unavailable.</p>{context ? <button type="button" onClick={() => {
    resources.discard(context); setResult({ identity: identity! }); setAttempt(value => value + 1);
  }}>Retry image</button> : null}</div>;
  if (!current?.src) return <p role="status">Loading image…</p>;
  return <div className={styles.instructionalImageSurface}>
    {/* eslint-disable-next-line @next/next/no-img-element -- Actor-scoped raster object URL; never a raw provider URL. */}
    <img className={styles.instructionalImage} src={current.src} alt={alt} decoding="async" onLoad={() => setDecoded(current.src)} onError={() => setResult({ identity: identity!, failed: true })} />
    <button className="cloudflare-stream-player-frame-control" type="button" disabled={decoded !== current.src} aria-label="Expand image" onClick={event => setExpanded({ src: current.src!, source: event.currentTarget })}>
      <ExpandVideoIcon className="cloudflare-stream-player-frame-control-icon" />
    </button>
    {expanded && expanded.src === current.src ? <ExpandedImage src={expanded.src} alt={alt} returnFocus={expanded.source} onClose={() => setExpanded(undefined)} /> : null}
  </div>;
}

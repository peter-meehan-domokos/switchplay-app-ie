"use client";
import { useEffect, useRef } from "react";

export default function MediaCentreControl({ total, onOpen }: { total: number; onOpen?: () => void }) {
  const button = useRef<HTMLButtonElement>(null);
  const interactive = Boolean(onOpen);
  useEffect(() => {
    const node = button.current;
    if (!node) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const scale = node.offsetWidth ? node.getBoundingClientRect().width / node.offsetWidth : 0;
      // Ancestor Card transforms shrink authored CSS pixels. Enlarge only the
      // invisible hit area; icon/count position and the Card layout stay fixed.
      // Ignore the edge-on portion of a flip, when the back is not interactive.
      if (scale < .25) return;
      const size = `${Math.max(44, 45 / scale)}px`;
      if (node.style.getPropertyValue("--media-centre-hit-size") !== size) node.style.setProperty("--media-centre-hit-size", size);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    const resize = new ResizeObserver(schedule), transform = new MutationObserver(schedule);
    resize.observe(node);
    for (let parent = node.parentElement; parent; parent = parent.parentElement) {
      transform.observe(parent, { attributes: true, attributeFilter: ["style"] });
    }
    window.addEventListener("resize", schedule); window.visualViewport?.addEventListener("resize", schedule);
    measure();
    return () => { cancelAnimationFrame(frame); resize.disconnect(); transform.disconnect(); window.removeEventListener("resize", schedule); window.visualViewport?.removeEventListener("resize", schedule); };
  }, [interactive]);
  const contents = <>
    {/* Traced from the supplied icon.png, using its 40×40 glyph crop.
        Separate stroke widths preserve the reference's frame/plus proportions. */}
    <svg aria-hidden="true" className="media-centre-icon" width="18" height="18" viewBox="0 0 40 40" preserveAspectRatio="xMidYMid meet" fill="none" stroke="currentColor" strokeWidth="4.1667" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7833 35.6167H8.6667A6.3333 6.3333 0 0 1 2.3333 29.2834V8.6667A6.3333 6.3333 0 0 1 8.6667 2.3333H29.3334A6.3333 6.3333 0 0 1 35.6667 8.6667V14.7167" />
      <path strokeWidth="5" d="M25.5 31.5h12M31.5 25.5v12" />
    </svg>
    {total > 5 ? <span className="media-centre-count">{total}</span> : null}
  </>;
  if (!onOpen) return <span className="focused-card-back-media-action media-centre-control" aria-hidden="true">{contents}</span>;
  return <button ref={button} type="button" className="focused-card-back-media-action media-centre-control" aria-label="Media Centre" aria-haspopup="dialog"
    onPointerDown={e => e.stopPropagation()} onPointerMove={e => e.stopPropagation()} onPointerUp={e => e.stopPropagation()} onPointerCancel={e => e.stopPropagation()}
    onKeyDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); e.currentTarget.focus({ preventScroll: true }); onOpen(); }}>{contents}</button>;
}

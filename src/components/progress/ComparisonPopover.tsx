"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
export type Comparison = { anchor: HTMLButtonElement; key: string; label: string; lines: string[] };
export default function ComparisonPopover({ value, id, onClose }: { value: Comparison; id: string; onClose(): void }) {
  const ref = useRef<HTMLDivElement>(null), [position, setPosition] = useState<{ left: number; top: number }>();
  useLayoutEffect(() => {
    const place = () => {
      if (!value.anchor.isConnected || !ref.current) return onClose();
      const anchor = value.anchor.getBoundingClientRect(), box = ref.current.getBoundingClientRect(), viewport = window.visualViewport;
      const leftEdge = viewport?.offsetLeft ?? 0, topEdge = viewport?.offsetTop ?? 0, width = viewport?.width ?? window.innerWidth, height = viewport?.height ?? window.innerHeight;
      const below = anchor.bottom + 6, top = below + box.height <= topEdge + height - 8 ? below : anchor.top - box.height - 6;
      setPosition({ left: Math.max(leftEdge + 8, Math.min(anchor.left + anchor.width / 2 - box.width / 2, leftEdge + width - box.width - 8)),
        top: Math.max(topEdge + 8, top) });
    };
    place(); window.addEventListener("resize", place); window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [value, onClose]);
  useEffect(() => {
    const outside = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node) && !value.anchor.contains(event.target as Node)) onClose(); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { onClose(); value.anchor.focus({ preventScroll: true }); } };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [value, onClose]);
  return createPortal(<div ref={ref} id={id} role="dialog" aria-label={`${value.label} comparison`} className="progress-comparison"
    style={{ position: "fixed", left: position?.left ?? 0, top: position?.top ?? 0, visibility: position ? "visible" : "hidden" }}>
    {value.lines.map((line, index) => <p key={index}>{line}</p>)}
  </div>, document.body);
}

"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { VisualContentDimensions } from "../core/host";

/** Generic lab chrome: measure the slot left by the page and its optional footer.
 * Content is opaque; no activity identifiers or internal DOM are inspected. */
export default function MeasuredContentSlot({ children, footer }: {
  children: (dimensions: VisualContentDimensions) => ReactNode; footer?: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null), slot = useRef<HTMLDivElement>(null), foot = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const measure = () => {
      const node = root.current!, viewport = window.visualViewport;
      const bottomPadding = Number.parseFloat(getComputedStyle(node.parentElement!).paddingBottom) || 0;
      const available = Math.max(0, (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight) - node.getBoundingClientRect().top - bottomPadding);
      setHeight(previous => previous === available ? previous : available);
      const { width, height } = slot.current!.getBoundingClientRect();
      setDimensions(previous => previous.width === width && previous.height === height ? previous : { width, height });
    };
    const observer = new ResizeObserver(measure);
    [root.current!.parentElement!, slot.current!, foot.current!].forEach(node => observer.observe(node));
    window.addEventListener("resize", measure); window.visualViewport?.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("scroll", measure);
    measure();
    return () => { observer.disconnect(); window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure); window.visualViewport?.removeEventListener("scroll", measure); };
  }, []);
  return <div ref={root} data-measured-content-slot="" style={{ display: "flex", flexDirection: "column", minWidth: 0, flexShrink: 0, height }}>
    <div ref={slot} style={{ flex: 1, minHeight: 0, minWidth: 0 }}>{children(dimensions)}</div>
    <div ref={foot} style={{ flexShrink: 0 }}>{footer}</div>
  </div>;
}

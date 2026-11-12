"use client";

import { useEffect, useRef, useState } from "react";

/** Browser adapter: portable sparkline preparation receives the actual available width. */
export const useSparklineWidth = (preferredWidth: number) => {
  const ref = useRef<HTMLDivElement>(null);
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      if (Number.isFinite(width) && width >= 48) setMeasuredWidth((previous) => previous === width ? previous : width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { ref, width: Math.min(preferredWidth, measuredWidth ?? preferredWidth) };
};

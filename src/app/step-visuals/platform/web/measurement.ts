"use client";

import { useEffect, useRef, useState } from "react";
import type { Size } from "../../core/graph/types";

const fallbackSize: Size = { width: 320, height: 280 };

/** Browser-only adapter; core layouts receive plain dimensions, never DOM elements. */
export const useGraphMeasurement = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<Size>(fallbackSize);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width < 160 || height < 160 || !Number.isFinite(width + height)) return;
      setSize((previous) => previous.width === width && previous.height === height ? previous : { width, height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { ref, size };
};

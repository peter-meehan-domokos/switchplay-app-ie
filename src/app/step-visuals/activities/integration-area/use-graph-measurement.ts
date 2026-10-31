"use client";

import { useEffect, useRef, useState } from "react";
import { minimumIntegrationGraphHeight } from "./container-layout";

/** Integration alone permits short graphs. The shared Roots measurement stays unchanged. */
export function useIntegrationGraphMeasurement() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 320, height: 280 });
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width < 160 || height < minimumIntegrationGraphHeight || !Number.isFinite(width + height)) return;
      setSize(previous => previous.width === width && previous.height === height ? previous : { width, height });
      setReady(true);
    });
    observer.observe(ref.current!);
    return () => observer.disconnect();
  }, []);
  return { ref, size, ready };
}

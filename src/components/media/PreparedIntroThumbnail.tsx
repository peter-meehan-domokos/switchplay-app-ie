import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

// The stack, focused Card and video poster may coexist. Draw a small copy rather
// than moving their shared decoded image or asking the browser to fetch it again.
export default function PreparedIntroThumbnail({ image, fallback }: { image?: HTMLImageElement; fallback: ReactNode }) {
  const [painted, setPainted] = useState(false);
  if (image && !painted) setPainted(true);
  const canvas = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const target = canvas.current;
    if (!target || !image) return;
    const draw = () => {
      if (!image.naturalWidth || !image.naturalHeight) return;
      const rect = target.getBoundingClientRect();
      const width = Math.max(1, Math.ceil(rect.width * window.devicePixelRatio));
      const height = Math.max(1, Math.ceil(rect.height * window.devicePixelRatio));
      target.width = Math.min(512, width); target.height = Math.min(512, height);
      const scale = Math.max(target.width / image.naturalWidth, target.height / image.naturalHeight);
      const w = image.naturalWidth * scale, h = image.naturalHeight * scale;
      target.getContext("2d")?.drawImage(image, (target.width - w) / 2, (target.height - h) / 2, w, h);
    };
    draw();
    const observer = new ResizeObserver(draw); observer.observe(target);
    return () => observer.disconnect();
  }, [image]);
  return <>{painted ? <canvas ref={canvas} className="intro-media-thumbnail" aria-hidden="true" /> : fallback}</>;
}

"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { boundImageTransform, fittedImage, gallerySwipeDirection, type ImageTransform } from "@/lib/cardMediaViewer";
import type { CloudflareR2ImageMediaItem } from "@/lib/media";
import styles from "./CardMediaViewer.module.css";

type Point = { x: number; y: number };
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const midpoint = (a: Point, b: Point) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

export default function CardMediaViewerImage({ item, onNavigate }: { item: CloudflareR2ImageMediaItem; onNavigate: (direction: -1 | 1) => void }) {
  const surface = useRef<HTMLDivElement>(null);
  const size = useRef({ width: 1, height: 1 });
  const naturalSize = useRef({ width: 1, height: 1 });
  const transformRef = useRef<ImageTransform>(fittedImage);
  const [transform, setTransform] = useState<ImageTransform>(fittedImage);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [attempt, setAttempt] = useState(0);
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<{ origin: Point; transform: ImageTransform; distance: number; multiple: boolean; moved: boolean } | null>(null);
  const lastTap = useRef<{ point: Point; time: number } | null>(null);

  const apply = (next: ImageTransform) => {
    const bounded = boundImageTransform(next, size.current, naturalSize.current);
    transformRef.current = bounded;
    setTransform(bounded);
  };
  useEffect(() => {
    const element = surface.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      size.current = { width: entry.contentRect.width, height: entry.contentRect.height };
      transformRef.current = fittedImage;
      setTransform(fittedImage);
      pointers.current.clear();
      gesture.current = null;
      lastTap.current = null;
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const pointFor = (event: PointerEvent<HTMLDivElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left - rect.width / 2, y: event.clientY - rect.top - rect.height / 2 };
  };
  const zoom = (scale: number, focal: Point = { x: 0, y: 0 }) => {
    const current = transformRef.current;
    const nextScale = Math.min(4, Math.max(1, scale));
    const ratio = nextScale / current.scale;
    apply({ scale: nextScale, x: focal.x - (focal.x - current.x) * ratio, y: focal.y - (focal.y - current.y) * ratio });
  };
  const start = (event: PointerEvent<HTMLDivElement>) => {
    if (status !== "ready" || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, pointFor(event));
    const points = Array.from(pointers.current.values());
    const multiple = points.length > 1 || Boolean(gesture.current?.multiple);
    if (multiple) lastTap.current = null;
    gesture.current = {
      origin: points.length > 1 ? midpoint(points[0], points[1]) : points[0],
      distance: points.length > 1 ? distance(points[0], points[1]) : 0,
      transform: transformRef.current, multiple, moved: false,
    };
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const session = gesture.current;
    if (!session || !pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, pointFor(event));
    const points = Array.from(pointers.current.values());
    if (points.length > 1) {
      const center = midpoint(points[0], points[1]);
      const nextScale = Math.max(1, Math.min(4, session.transform.scale * distance(points[0], points[1]) / Math.max(1, session.distance)));
      const ratio = nextScale / session.transform.scale;
      apply({ scale: nextScale, x: center.x - (session.origin.x - session.transform.x) * ratio, y: center.y - (session.origin.y - session.transform.y) * ratio });
      session.moved = true;
    } else {
      const dx = points[0].x - session.origin.x;
      const dy = points[0].y - session.origin.y;
      if (Math.hypot(dx, dy) > 10) session.moved = true;
      if (session.transform.scale > 1) apply({ ...session.transform, x: session.transform.x + dx, y: session.transform.y + dy });
    }
  };
  const end = (event: PointerEvent<HTMLDivElement>, cancelled = false) => {
    const session = gesture.current;
    if (!session || !pointers.current.has(event.pointerId)) return;
    const point = pointFor(event);
    const dx = point.x - session.origin.x;
    const dy = point.y - session.origin.y;
    pointers.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (cancelled) { pointers.current.clear(); gesture.current = null; lastTap.current = null; return; }
    if (pointers.current.size) {
      gesture.current = { origin: Array.from(pointers.current.values())[0], transform: transformRef.current, distance: 0, multiple: true, moved: true };
      return;
    }
    gesture.current = null;
    if (session.multiple) return;
    if (session.transform.scale === 1 && gallerySwipeDirection(dx, dy)) {
      lastTap.current = null;
      onNavigate(gallerySwipeDirection(dx, dy) as -1 | 1);
      return;
    }
    if (session.moved || Math.hypot(dx, dy) > 10) { lastTap.current = null; return; }
    const now = performance.now();
    if (lastTap.current && now - lastTap.current.time < 320 && distance(point, lastTap.current.point) < 24) {
      zoom(transformRef.current.scale > 1 ? 1 : 2.5, point);
      lastTap.current = null;
    } else lastTap.current = { point, time: now };
  };
  return <div className={styles.imageArea}>
    <div className={styles.imageSurface} ref={surface} onPointerDown={start} onPointerMove={move} onPointerUp={(event) => end(event)} onPointerCancel={(event) => end(event, true)}
      aria-label="Image. Pinch or double tap to zoom; drag to pan when zoomed.">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img key={attempt} className={styles.image} src={item.src} alt={item.description || "Card image"} draggable={false}
        style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`, visibility: status === "ready" ? "visible" : "hidden" }}
        onLoad={(event) => { naturalSize.current = { width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight }; setStatus("ready"); }} onError={() => setStatus("failed")} />
      {status !== "ready" ? <div className={styles.mediaStatus} role={status === "failed" ? "alert" : "status"}>
        <p>{status === "loading" ? "Loading image…" : "This image could not be loaded."}</p>
        {status === "failed" ? <button className={styles.control} type="button" onClick={() => { setStatus("loading"); setAttempt((value) => value + 1); }}>Retry image</button> : null}
      </div> : null}
    </div>
    <div className={styles.zoomControls} role="group" aria-label="Image zoom">
      <button className={styles.control} type="button" aria-label="Zoom out" disabled={status !== "ready" || transform.scale <= 1} onClick={() => zoom(transformRef.current.scale - 0.5)}>−</button>
      <output aria-label="Zoom level">{Math.round(transform.scale * 100)}%</output>
      <button className={styles.control} type="button" aria-label="Zoom in" disabled={status !== "ready" || transform.scale >= 4} onClick={() => zoom(transformRef.current.scale + 0.5)}>+</button>
      <button className={styles.control} type="button" disabled={status !== "ready" || transform.scale === 1} onClick={() => apply(fittedImage)}>Reset zoom</button>
    </div>
  </div>;
}

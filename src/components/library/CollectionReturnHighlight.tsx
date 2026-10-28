"use client";
import { useEffect, useRef } from "react";

/** A one-time collection affordance; does not open content or persist recency. */
export default function CollectionReturnHighlight({ id, ready, scroll = false }: { id: string | null; ready: boolean; scroll?: boolean }) {
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (!id || !ready || handled.current === id) return;
    const element = [...document.querySelectorAll<HTMLElement>("[data-collection-item-id]")].find(node => node.dataset.collectionItemId === id);
    if (!element) return;
    let animation: Animation | undefined, timer: ReturnType<typeof setTimeout> | undefined;
    const frame = requestAnimationFrame(() => {
      handled.current = id;
      if (scroll) element.scrollIntoView({ block: "center", behavior: "instant" });
      element.dataset.returnHighlight = "true";
      animation = element.animate([{ outline: "2px solid #91afc5", outlineOffset: "5px" }, { outline: "2px solid transparent", outlineOffset: "5px" }],
        { duration: matchMedia("(prefers-reduced-motion: reduce)").matches ? 900 : 1800 });
      timer = setTimeout(() => { delete element.dataset.returnHighlight; }, 1900);
    });
    return () => { cancelAnimationFrame(frame); clearTimeout(timer); animation?.cancel(); delete element.dataset.returnHighlight; };
  }, [id, ready, scroll]);
  return null;
}

"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { tooltipLayout } from "../../core/presentation/tooltip-layout";
import styles from "./tooltip.module.css";

export type TooltipProps = Readonly<{ children: string; title: string; content: ReactNode; disabled?: boolean; onOpen?: () => void; maxWidth?: number }>;

function ActiveTooltip({ children, title, content, onOpen, maxWidth }: Omit<TooltipProps, "disabled">) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<ReturnType<typeof tooltipLayout> | null>(null);
  const measure = useCallback(() => {
    if (!trigger.current || !popup.current) return;
    const anchor = trigger.current.getBoundingClientRect();
    const size = popup.current.getBoundingClientRect();
    const visual = window.visualViewport;
    const next = tooltipLayout(anchor, size, { x: visual?.offsetLeft ?? 0, y: visual?.offsetTop ?? 0,
      width: visual?.width ?? document.documentElement.clientWidth, height: visual?.height ?? innerHeight });
    setPlacement((previous) => previous && Object.keys(next).every((key) => previous[key as keyof typeof next] === next[key as keyof typeof next]) ? previous : next);
  }, []);
  // A callback ref measures the newly mounted surface before it is painted.
  const attach = useCallback((node: HTMLDivElement | null) => { popup.current = node; if (node) measure(); }, [measure]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: Event) => {
      const target = event.target as Node;
      if (!trigger.current?.contains(target) && !popup.current?.contains(target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); setOpen(false); } };
    const observer = new ResizeObserver(measure);
    if (trigger.current) observer.observe(trigger.current);
    if (popup.current) observer.observe(popup.current);
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("focusin", outside);
    document.addEventListener("keydown", escape);
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("scroll", measure);
    return () => {
      observer.disconnect();
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("focusin", outside);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("scroll", measure);
    };
  }, [open, measure]);
  return <>
    <button ref={trigger} type="button" className={styles.trigger} data-spv-tooltip-trigger aria-expanded={open}
      aria-controls={open ? id : undefined} aria-describedby={open ? id : undefined} onClick={() => { if (!open) onOpen?.(); setOpen(!open); }}>{children}</button>
    {open ? createPortal(<div ref={attach} id={id} className={styles.popup} role="tooltip" data-side={placement?.side}
      style={{ left: placement?.left ?? 0, top: placement?.top ?? 0, maxWidth: `min(${maxWidth === undefined ? "18rem" : `${maxWidth}px`}, ${placement ? `${placement.maxWidth}px` : "calc(100vw - 16px)"})`, maxHeight: placement?.maxHeight, visibility: placement ? "visible" : "hidden" }}>
      <strong>{title}</strong><p>{content}</p>
    </div>, document.body) : null}
  </>;
}

/** Inline, click/touch/keyboard explanation. No learning state or glossary registry. */
export default function Tooltip({ disabled = false, ...props }: TooltipProps) {
  // Suspension unmounts the popup and its listeners, without retaining an open overlay.
  return disabled ? <span>{props.children}</span> : <ActiveTooltip {...props} />;
}

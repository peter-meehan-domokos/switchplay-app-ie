"use client";

import { useLayoutEffect, useRef } from "react";
import styles from "./InfoCardPouch.module.css";

export type InfoCardPouchProps = {
  count: number;
  expanded: boolean;
  pending?: boolean;
  position?: number;
  controlsId: string;
  onToggle: () => void;
};

export default function InfoCardPouch({ count, expanded, pending = false, position = 1, controlsId, onToggle }: InfoCardPouchProps) {
  const numeral = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    if (!numeral.current) return;
    if (!expanded) { numeral.current.style.transform = ""; return; }
    let active = true;
    const centreInk = () => {
      if (!active || !numeral.current) return;
      const node = numeral.current, css = getComputedStyle(node);
      const context = document.createElement("canvas").getContext("2d");
      if (!context) return;
      context.font = `${css.fontWeight} ${css.fontSize} ${css.fontFamily}`;
      const text = context.measureText(String(position));
      // Centre the glyph's ink, not its advance width or line box. This matters
      // particularly for "1" and remains independent of the closed icon group.
      const x = (text.width + text.actualBoundingBoxLeft - text.actualBoundingBoxRight) / 2;
      const y = (text.actualBoundingBoxAscent - text.actualBoundingBoxDescent
        - text.fontBoundingBoxAscent + text.fontBoundingBoxDescent) / 2;
      node.style.transform = `translate(${x}px, ${Number.isFinite(y) ? y : 0}px)`;
    };
    centreInk();
    void document.fonts.ready.then(centreInk);
    return () => { active = false; };
  }, [expanded, position]);
  if (count < 1) return null;
  return (
    <button
      className={styles.pouch}
      type="button"
      aria-label={`${expanded || pending ? "Close" : "Open"} information cards (${count} attached)`}
      aria-expanded={expanded}
      aria-controls={expanded ? controlsId : undefined}
      onClick={onToggle}
      data-info-card-pouch=""
      data-count-digits={String(count).length}
    >
      <span className={styles.artwork} aria-hidden="true">
        <svg className={styles.shape} viewBox="0 0 46 46" aria-hidden="true">
          <path d="M0 0 L46 46 H0 Z" />
          <path className={styles.fold} d="M0 0 L46 46" />
        </svg>
        <span className={styles.label} aria-hidden="true" data-info-card-pouch-label="">
          {!expanded && <svg className={styles.information} viewBox="0 0 16 16" data-info-card-pouch-icon="">
            <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
            <circle cx="8" cy="4.5" r="1" fill="currentColor" />
            <path d="M8 7.5v4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>}
          <span ref={numeral} data-info-card-pouch-count="">{expanded ? position : count}</span>
        </span>
      </span>
    </button>
  );
}

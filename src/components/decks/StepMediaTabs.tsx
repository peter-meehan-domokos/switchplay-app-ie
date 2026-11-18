"use client";

import type { StepMediaItem } from "@/lib/stepMedia";
import styles from "./StepMediaTabs.module.css";

export default function StepMediaTabs({ items, selectedId, panelId, onSelect }: { items: readonly StepMediaItem[]; selectedId: string; panelId: string; onSelect: (id: string) => void }) {
  if (items.length < 2) return null;
  return <div className={styles.tabs} role="tablist" aria-label="Step media" onKeyDown={event => {
    const index = items.findIndex(item => item.id === selectedId);
    const next = event.key === "ArrowRight" ? (index + 1) % items.length : event.key === "ArrowLeft" ? (index - 1 + items.length) % items.length
      : event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : null;
    if (next === null) return;
    event.preventDefault(); event.stopPropagation(); onSelect(items[next].id);
    event.currentTarget.querySelectorAll<HTMLButtonElement>("[role=tab]")[next]?.focus({ preventScroll: true });
  }}>
    {items.map((item, index) => <button key={item.id} id={`${panelId}-tab-${index}`} aria-controls={panelId} type="button" role="tab" className={styles.tab} aria-selected={item.id === selectedId}
      tabIndex={item.id === selectedId ? 0 : -1} onClick={() => onSelect(item.id)}>{item.label}</button>)}
  </div>;
}

"use client";

import { useEffect, useId, useRef, useState } from "react";
import styles from "./InfoCardFace.module.css";

// `origin` names where the displayed note was created, shown read-only outside that context (C1).
export type InfoCardActions = { onNew: () => void; onEdit?: () => void; onRemove?: () => void; origin?: string; disabled?: boolean };

export default function InfoCardMenu({ onNew, onEdit, onRemove, origin, disabled }: InfoCardActions) {
  const [open, setOpen] = useState(false), id = useId();
  const region = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const isOpen = useRef(false), swallowClick = useRef(false);
  function close(focus = true) { isOpen.current = false; setOpen(false); if (focus) trigger.current?.focus({ preventScroll: true }); }
  useEffect(() => {
    const outside = (event: globalThis.PointerEvent) => {
      if (!isOpen.current || region.current?.contains(event.target as Node)) return;
      event.preventDefault(); event.stopImmediatePropagation(); swallowClick.current = true;
      isOpen.current = false; setOpen(false); trigger.current?.focus({ preventScroll: true });
    };
    const click = (event: globalThis.MouseEvent) => {
      if (!swallowClick.current) return;
      swallowClick.current = false; event.preventDefault(); event.stopImmediatePropagation();
    };
    document.addEventListener("pointerdown", outside, true); document.addEventListener("click", click, true);
    return () => { document.removeEventListener("pointerdown", outside, true); document.removeEventListener("click", click, true); };
  }, []);
  const items = [{ label: "+ New", action: onNew }, ...(onEdit ? [{ label: "Edit", action: onEdit }] : []), ...(onRemove ? [{ label: "Remove", action: onRemove }] : [])];
  return <div ref={region} className={styles.menu} data-info-card-menu="" onPointerDown={event => event.stopPropagation()}
    onClick={event => event.stopPropagation()} onKeyDown={event => {
      event.stopPropagation();
      const buttons = [...(region.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])];
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      if (event.key === "Escape") { event.preventDefault(); close(); }
      else if (open && ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
        event.preventDefault(); const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1
          : (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
        buttons[next]?.focus();
      } else if (event.key === "Tab") close(false);
    }}>
    <button ref={trigger} type="button" className={styles.menuTrigger} aria-label="Info Card actions" aria-haspopup="menu"
      aria-expanded={open && !disabled} aria-controls={open && !disabled ? id : undefined} disabled={disabled}
      onClick={() => {
        if (open) close(); else { isOpen.current = true; setOpen(true); requestAnimationFrame(() => region.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus()); }
      }}>⋯</button>
    {open && !disabled && <div className={styles.menuItems} id={id} role="menu" aria-label="Info Card actions">
      {origin && <p className={styles.menuOrigin} role="none" data-info-card-origin=""><span>Created in:</span><span>{origin}</span></p>}
      {items.map(item => <button key={item.label} type="button" role="menuitem" tabIndex={-1} onClick={() => { close(false); item.action(); }}>{item.label}</button>)}
    </div>}
  </div>;
}

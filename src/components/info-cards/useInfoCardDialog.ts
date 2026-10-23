"use client";

import { useLayoutEffect, type KeyboardEvent, type RefObject, type SyntheticEvent } from "react";

export const isolateInfoCardEvent = (event: SyntheticEvent) => event.stopPropagation();

// Local to the two info-card layers. Native modal dialogs inert the entire
// background, including the separately hosted video and any enclosing dialog.
export function useInfoCardDialog(dialog: RefObject<HTMLDialogElement | null>, initialFocus: RefObject<HTMLButtonElement | null>, returnFocus?: HTMLElement, lockScroll = false) {
  useLayoutEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const source = returnFocus ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const scroll = { x: window.scrollX, y: window.scrollY };
    const saved = (lockScroll ? [document.documentElement, document.body] : []).map(node => ({ node,
      overflow: node.style.getPropertyValue("overflow"), priority: node.style.getPropertyPriority("overflow") }));
    saved.forEach(({ node }) => node.style.setProperty("overflow", "hidden"));
    element.showModal();
    initialFocus.current?.focus({ preventScroll: true });
    // Native video controls can blur the focused control even when their inert
    // ancestor prevents them receiving focus. Keep that escape inside the
    // topmost modal, without competing with the nested media dialog.
    const retainFocus = () => queueMicrotask(() => {
      const top = Array.from(document.querySelectorAll("dialog:modal")).at(-1);
      if (element.open && top === element && !element.contains(document.activeElement)) {
        initialFocus.current?.focus({ preventScroll: true });
      }
    });
    document.addEventListener("focusout", retainFocus, true);
    document.addEventListener("focusin", retainFocus, true);
    return () => {
      document.removeEventListener("focusout", retainFocus, true);
      document.removeEventListener("focusin", retainFocus, true);
      element.close();
      saved.forEach(({ node, overflow, priority }) => overflow
        ? node.style.setProperty("overflow", overflow, priority) : node.style.removeProperty("overflow"));
      if (window.scrollX !== scroll.x || window.scrollY !== scroll.y) window.scrollTo(scroll.x, scroll.y);
      // Parent inert attributes are removed in this commit after child cleanup.
      queueMicrotask(() => {
        if (source?.isConnected && !source.closest("[inert]") && source.getClientRects().length) source.focus({ preventScroll: true });
      });
    };
  }, [dialog, initialFocus, returnFocus, lockScroll]);
}

export function containInfoCardFocus(event: KeyboardEvent<HTMLDialogElement>) {
  event.stopPropagation();
  if (event.key !== "Tab") return;
  const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
    "button:not(:disabled), a[href], input:not(:disabled), video[controls], [tabindex]:not([tabindex='-1'])"
  )).filter(node => node.tabIndex >= 0 && node.getClientRects().length && !node.closest("[inert]"));
  const first = controls[0], last = controls.at(-1), active = document.activeElement;
  if (!first || !controls.includes(active as HTMLElement) || (event.shiftKey && active === first) || (!event.shiftKey && active === last)) {
    event.preventDefault();
    (event.shiftKey ? last : first)?.focus({ preventScroll: true });
  }
}

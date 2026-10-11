"use client";
import { useEffect, useRef, type ReactNode } from "react";
export default function LibraryDialog({ title, children, onCancel, className = "", isolateInteractions = false }: { title: string; children: ReactNode; onCancel: () => void; className?: string; isolateInteractions?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    dialog?.showModal();
    return () => { dialog?.close(); previous?.focus(); };
  }, []);
  const isolate = (event: React.SyntheticEvent) => { if (isolateInteractions) event.stopPropagation(); };
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDialogElement>) => {
    if (isolateInteractions && event.key === "Escape") {
      event.preventDefault(); onCancel();
    }
    if (isolateInteractions && event.key === "Tab") {
      const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex='-1'])"))
        .filter((element) => element.getClientRects().length > 0 && !element.closest("[inert]"));
      const first = controls[0], last = controls.at(-1), active = document.activeElement;
      if (!first || event.shiftKey && active === first || !event.shiftKey && active === last) {
        event.preventDefault(); (event.shiftKey ? last : first)?.focus();
        if (!first) event.currentTarget.focus();
      }
    }
    isolate(event);
  };
  return <dialog ref={ref} tabIndex={-1} className={`library-dialog ${className}`} aria-label={title}
    onClick={isolate} onKeyDown={handleKeyDown} onPointerDown={isolate} onPointerMove={isolate} onPointerUp={isolate} onPointerCancel={isolate}
    onCancel={(event) => { event.preventDefault(); onCancel(); }}>
    <h2>{title}</h2>{children}
  </dialog>;
}

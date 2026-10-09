"use client";
import { useEffect, useRef, type ReactNode } from "react";
export default function LibraryDialog({ title, children, onCancel }: { title: string; children: ReactNode; onCancel: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    return () => { previous?.focus(); };
  }, []);
  return <dialog ref={ref} className="library-dialog" aria-label={title} onCancel={(event) => { event.preventDefault(); onCancel(); }}>
    <h2>{title}</h2>{children}
  </dialog>;
}

"use client";
import { useEffect, useRef } from "react";
export default function CreatorCopyConfirmation({ entity, onConfirm, onCancel }: { entity: "Card" | "Deck"; onConfirm: () => void; onCancel: () => void }) {
  const modal = useRef<HTMLDivElement>(null);
  useEffect(() => { modal.current?.querySelector<HTMLButtonElement>("button")?.focus(); }, []);
  return <div className="creator-modal-backdrop"><div ref={modal} className="creator-modal" role="dialog" aria-modal="true" aria-label={`Edit your own ${entity}`}
    onKeyDown={(event) => {
      if (event.key === "Escape") { event.stopPropagation(); onCancel(); }
      if (event.key === "Tab") {
        const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button")];
        if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons.at(-1)?.focus(); }
        else if (!event.shiftKey && document.activeElement === buttons.at(-1)) { event.preventDefault(); buttons[0]?.focus(); }
      }
    }}>
    <p>This {entity} belongs to another creator. Your first saved change will create your own editable copy. The original will stay unchanged.</p>
    <div className="creator-modal-actions"><button type="button" className="creator-modal-secondary" onClick={onCancel}>Cancel</button>
      <button type="button" className="creator-modal-primary" onClick={onConfirm}>Continue editing</button></div>
  </div></div>;
}

"use client";
import { useEffect, useLayoutEffect, useRef, type FormEvent } from "react";
import { createPortal } from "react-dom";

// The existing reflection editor shell, also used for source-bound read-only views.
export default function ReflectionModal({ text, editable, canDelete, explanation, error, saving, onChange, onSave, onDelete, onClose }: {
  text: string; editable: boolean; canDelete: boolean; explanation: string | null; error: string | null; saving: boolean;
  onChange(text: string): void; onSave(): void; onDelete(): void; onClose(): void;
}) {
  const dialog = useRef<HTMLFormElement>(null), close = useRef<HTMLButtonElement>(null);
  const closing = useRef(onClose), busy = useRef(saving);
  useEffect(() => { closing.current = onClose; busy.current = saving; }, [onClose, saving]);
  useLayoutEffect(() => {
    const background = document.querySelector<HTMLElement>(".app-shell"), wasInert = background?.inert;
    const source = document.activeElement as HTMLElement, overflow = document.body.style.overflow;
    background?.setAttribute("inert", ""); document.body.style.overflow = "hidden"; close.current?.focus({ preventScroll: true });
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); if (!busy.current) closing.current(); }
      if (event.key !== "Tab") return;
      const focusable = [...(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), textarea:not(:disabled), [tabindex="0"]') ?? [])];
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("keydown", key); if (!wasInert) background?.removeAttribute("inert"); document.body.style.overflow = overflow; if (source?.isConnected) source.focus({ preventScroll: true }); };
  }, []);
  const submit = (e: FormEvent) => { e.preventDefault(); if (editable && !saving) onSave(); };
  return createPortal(<div className="creator-modal-backdrop reflection-editor-backdrop" onClick={e => { if (e.target === e.currentTarget && !saving) onClose(); }}>
    <form ref={dialog} className="creator-modal creator-modal--reflection-editor reflection-editor-modal" role="dialog" aria-modal="true" aria-label={editable ? "Edit reflection" : "View reflection"}
      onSubmit={submit} onPointerDown={e => e.stopPropagation()} onPointerMove={e => e.stopPropagation()} onPointerUp={e => e.stopPropagation()}>
      <header className="creator-modal-header"><p>{editable ? "Edit reflection" : "Reflection"}</p><button ref={close} className="creator-modal-close" disabled={saving} onClick={onClose} type="button">Close</button></header>
      {editable ? <p className="creator-modal-note">Aim for about 9 words. Longer reflections may be truncated on the card.</p> : explanation ? <p className="creator-modal-note">{explanation}</p> : null}
      <textarea aria-label="Reflection" className="creator-modal-field creator-modal-field--reflection" readOnly={!editable} disabled={saving} maxLength={20000} value={text} onChange={e => onChange(e.target.value)} />
      {editable ? <p className={`creator-modal-counter${text.length > 55 ? " creator-modal-counter--warning" : ""}`}>{text.length}/55 recommended characters</p> : null}
      {error ? <p role="alert" className="creator-modal-error">{error}</p> : null}
      <div className="creator-modal-actions">
        {canDelete ? <button type="button" className="creator-modal-secondary" disabled={saving} onClick={onDelete}>Delete</button> : null}
        <button type="button" className="creator-modal-secondary" disabled={saving} onClick={onClose}>{editable ? "Cancel" : "Close"}</button>
        {editable ? <button className="creator-modal-primary" type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</button> : null}
      </div>
    </form>
  </div>, document.body);
}

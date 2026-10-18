"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import LibraryDialog from "@/components/library/LibraryDialog";

type DeckMenuProps = {
  deckId: string;
  deckTemplateId: string;
  editHref?: string;
  showEdit?: boolean;
  deckTitle?: string;
  onArchive?: () => Promise<boolean>;
  archiveDisabled?: boolean;
  membershipAction?: { label: string; disabled: boolean; onSelect: () => void };
};

export default function DeckMenu({ deckId, deckTemplateId, editHref, showEdit = true, deckTitle, onArchive, archiveDisabled = false, membershipAction }: DeckMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isOpen) return;
    const dismiss = (event: PointerEvent) => { if (!menu.current?.contains(event.target as Node)) setIsOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setIsOpen(false); trigger.current?.focus(); } };
    document.addEventListener("pointerdown", dismiss); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", dismiss); document.removeEventListener("keydown", escape); };
  }, [isOpen]);
  const href = editHref ?? `/creator/edit/${encodeURIComponent(deckTemplateId)}?returnTo=deck&returnDeckId=${encodeURIComponent(deckId)}&returnDeckTemplateId=${encodeURIComponent(deckTemplateId)}`;

  return (
    <div className="deck-menu" ref={menu}>
      <button
        ref={trigger}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="Deck menu"
        className="deck-menu-trigger"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <span aria-hidden="true">•••</span>
      </button>
      {isOpen ? (
        <div className="deck-menu-popover" role="menu">
          {showEdit ? <Link className="deck-menu-item" href={href} prefetch={editHref ? false : undefined} role="menuitem">
            Edit
          </Link> : null}
          {onArchive ? <button className="deck-menu-item deck-menu-button" type="button" role="menuitem" disabled={archiveDisabled}
            onClick={() => { setIsOpen(false); setError(""); trigger.current?.focus(); setConfirmArchive(true); }}>Archive</button> : null}
          {membershipAction ? <button className="deck-menu-item deck-menu-button" type="button" role="menuitem" disabled={membershipAction.disabled}
            onClick={() => { setIsOpen(false); trigger.current?.focus(); membershipAction.onSelect(); }}>{membershipAction.label}</button> : null}
        </div>
      ) : null}
      {confirmArchive && onArchive ? <LibraryDialog title={`Archive ${deckTitle ?? deckTemplateId}`} isolateInteractions
        onCancel={() => { if (!submitting.current) setConfirmArchive(false); }}>
        <p>This moves the Deck to Archived decks. Your learning progress is kept, and you can restore it later.</p>
        {error ? <p role="alert">{error}</p> : null}
        <button type="button" disabled={archiving} onClick={() => setConfirmArchive(false)}>Cancel</button>
        <button type="button" disabled={archiving || archiveDisabled} onClick={async () => {
          if (submitting.current || archiveDisabled) return;
          submitting.current = true; setArchiving(true); setError("");
          try {
            if (await onArchive()) setConfirmArchive(false);
            else setError("Unable to archive this Deck. Please try again.");
          } catch { setError("Unable to archive this Deck. Please try again."); }
          finally { submitting.current = false; setArchiving(false); }
        }}>{archiving ? "Archiving…" : "Archive"}</button>
      </LibraryDialog> : null}
    </div>
  );
}

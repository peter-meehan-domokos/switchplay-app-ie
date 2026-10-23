"use client";

import { useEffect, useRef } from "react";
import type { CreatorDraftEntry } from "./creatorDraftEntries";

export default function CreatorDraftsModal({ drafts, currentDeckTemplateId, currentInfoCardId, loading, error, switchingTo, onSelect, onClose }: {
  drafts: CreatorDraftEntry[];
  currentDeckTemplateId: string;
  currentInfoCardId?: string;
  loading: boolean;
  error: string;
  switchingTo: string | null;
  onSelect: (id: string, kind: CreatorDraftEntry["kind"]) => void;
  onClose: () => void;
}) {
  const modal = useRef<HTMLDivElement>(null);
  useEffect(() => { modal.current?.querySelector<HTMLButtonElement>("button")?.focus(); }, []);
  return <div className="creator-modal-backdrop">
    <div className="creator-modal creator-drafts-modal" ref={modal} role="dialog" aria-modal="true" aria-label="My Drafts"
      aria-busy={loading || switchingTo !== null} onKeyDown={(event) => {
        if (event.key === "Escape" && switchingTo === null) { event.stopPropagation(); onClose(); }
        if (event.key === "Tab") {
          const buttons = [...modal.current!.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
          const first = buttons[0], last = buttons.at(-1);
          if (!first) { event.preventDefault(); return; }
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
      }}>
      <header className="creator-modal-header"><p>My Drafts</p>
        <button className="creator-modal-close" type="button" disabled={switchingTo !== null} onClick={onClose}>Close</button>
      </header>
      {loading ? <p>Loading drafts…</p> : null}
      {error ? <p role="alert" className="creator-modal-error">{error}</p> : null}
      {!loading && !error && drafts.length === 0 ? <p>No unfinished drafts.</p> : null}
      <ul className="creator-drafts-list">
        {drafts.map((draft) => { const id = draft.kind === "deck" ? draft.deckTemplateId : draft.infoCardId;
          return <li key={`${draft.kind}:${id}`}>
          <button type="button" aria-current={(draft.kind === "deck" ? id === currentDeckTemplateId : id === currentInfoCardId) ? "true" : undefined}
            disabled={switchingTo !== null} onClick={() => onSelect(id, draft.kind)}>
            {draft.title || (draft.kind === "deck" ? "Untitled Deck" : "Untitled Info Card")}
            {draft.kind === "infoCard" ? <small> · Info Card</small> : null}
          </button>
        </li>; })}
      </ul>
      {switchingTo !== null ? <p role="status">Saving current work before switching…</p> : null}
    </div>
  </div>;
}

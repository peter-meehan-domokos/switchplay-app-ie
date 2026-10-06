"use client";

import { useEffect, useRef } from "react";
import type { CreatorDraftSummary } from "@/lib/cards/creatorDrafts";

export default function CreatorDraftsModal({ drafts, currentDeckTemplateId, loading, error, switchingTo, onSelect, onClose }: {
  drafts: CreatorDraftSummary[];
  currentDeckTemplateId: string;
  loading: boolean;
  error: string;
  switchingTo: string | null;
  onSelect: (id: string) => void;
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
      {!loading && !error && drafts.length === 0 ? <p>No unfinished Deck drafts.</p> : null}
      <ul className="creator-drafts-list">
        {drafts.map((draft) => <li key={draft.deckTemplateId}>
          <button type="button" aria-current={draft.deckTemplateId === currentDeckTemplateId ? "true" : undefined}
            disabled={switchingTo !== null} onClick={() => onSelect(draft.deckTemplateId)}>
            {draft.title || "Untitled Deck"}
          </button>
        </li>)}
      </ul>
      {switchingTo !== null ? <p role="status">Saving current work before switching…</p> : null}
    </div>
  </div>;
}

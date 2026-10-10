"use client";

import { useState } from "react";
import type { CopyCardCommand, CopyCardResult, CopyDestination } from "@/lib/cards/cardReuse";
import { creatorRequest, CreatorRequestError, type CreatorTransport } from "./creatorRequest";

export default function CreatorCopyTo({ cardTemplateId, deckTemplateId, ensureCreated, onReused, foreign = false, sourceVersion, request = creatorRequest }: {
  cardTemplateId: string; deckTemplateId: string; ensureCreated: () => Promise<void>; onReused: () => void; foreign?: boolean; sourceVersion?: number; request?: CreatorTransport;
}) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false);
  const [destinations, setDestinations] = useState<CopyDestination[]>([]);
  const [message, setMessage] = useState(""), [error, setError] = useState("");
  const [retry, setRetry] = useState<CopyCardCommand | null>(null);
  const url = `/api/card-templates/${encodeURIComponent(cardTemplateId)}/copy-to`;
  async function load() {
    setOpen(true); setBusy(true); setError(""); setMessage(""); setRetry(null);
    try {
      // Identity persistence only; pending Card content need not be flushed to reuse it.
      await ensureCreated();
      setDestinations(await request(`${url}?currentDeckTemplateId=${encodeURIComponent(deckTemplateId)}`));
    } catch { setError("Could not load destinations. Resolve any Card creation error, then refresh."); }
    finally { setBusy(false); }
  }
  async function copy(command: CopyCardCommand) {
    setBusy(true); setError(""); setMessage(""); setRetry(null);
    try {
      let result: CopyCardResult;
      for (let attempt = 0; ; attempt++) {
        try { result = await request<CopyCardResult>(url, "POST", command); break; }
        catch (cause) {
          const transient = !(cause instanceof CreatorRequestError) || cause.status >= 500;
          if (!transient) { setError("The destination changed or is unavailable. Refresh destinations before trying again."); return; }
          if (attempt === 3) { setRetry(command); setError("Copy could not be confirmed. Retry the same request to check its outcome."); return; }
          await new Promise<void>((resolve) => setTimeout(resolve, [1000, 3000, 8000][attempt]));
        }
      }
      onReused();
      setDestinations((current) => current.map((item) => item.deckTemplateId === command.deckTemplateId ? { ...item, alreadyContains: true } : item));
      setMessage(result.outcome === "published" ? "Copied and published in the destination Deck."
        : "Copied to the destination draft. Publish that Deck to make it live.");
    } finally { setBusy(false); }
  }
  return <section className="creator-modal-delete-section creator-copy-to" data-open={open} aria-label="Copy Card">
    <button className="creator-modal-secondary" type="button" disabled={busy} onClick={() => open ? setOpen(false) : void load()}>
      {open ? "Close destinations" : "Copy to…"}
    </button>
    {open ? <>
      <p className="creator-modal-delete-note">{foreign ? "Reuse this shared Card in another owned Deck without changing the original." : "Reuse this Card in another owned Deck. Edits apply wherever this Card is used."}</p>
      {busy ? <p role="status">Working…</p> : null}
      {error ? <p className="creator-modal-error" role="alert">{error}</p> : null}
      {message ? <p role="status">{message}</p> : null}
      {!busy && !error && destinations.length === 0 ? <p>No other owned Decks.</p> : null}
      <ul className="creator-drafts-list">
        {destinations.map((item) => <li key={item.deckTemplateId}><button type="button"
          disabled={busy || item.alreadyContains} title={item.alreadyContains ? "Already contains this Card" : undefined}
          onClick={() => void copy({ deckTemplateId: item.deckTemplateId, revision: item.revision, contentHash: item.contentHash,
            ...(sourceVersion !== undefined ? { sourceVersion } : {}) })}>
          {item.title || "Untitled Deck"}{item.alreadyContains ? " — already contains this Card" : ""}
        </button></li>)}
      </ul>
      {retry ? <button className="creator-modal-secondary" type="button" disabled={busy} onClick={() => void copy(retry)}>Retry Copy</button> : null}
      {error && !retry ? <button className="creator-modal-secondary" type="button" disabled={busy} onClick={() => void load()}>Refresh destinations</button> : null}
    </> : null}
  </section>;
}

"use client";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import LibraryDialog from "@/components/library/LibraryDialog";
import ActiveCardFront from "@/components/cards/ActiveCardFront";
import CardCreatorAttribution from "@/components/cards/CardCreatorAttribution";
import DeckFrontContents from "@/components/decks/DeckFrontContents";
import { workingRequest, WorkingRequestError } from "@/components/decks/updateClient";
import type { ItemCardDestination, ItemDeckContext, ItemDestinations } from "@/lib/frameworks/destinations";
import { flushPersonalMutations } from "@/lib/deckMutations";
import { progressLibraryHref, progressWorkingHref } from "./progressDeckSelection";
import styles from "./areaDialog.module.css";
import cardStyles from "./itemDialog.module.css";

export default function ItemCardDialog({ actor, frameworkId, itemId, title, onClose, onLeaving }: {
  actor: string; frameworkId: string; itemId: string; title: string; onClose(): void; onLeaving(): void;
}) {
  const router = useRouter(), live = useRef(true), running = useRef(false), controller = useRef<AbortController | null>(null);
  const [data, setData] = useState<ItemDestinations>(), [error, setError] = useState("");
  const [loading, setLoading] = useState(true), [pending, setPending] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null), [archived, setArchived] = useState<ItemDeckContext | null>(null);
  const content = useRef<HTMLDivElement>(null), back = useRef<HTMLButtonElement>(null), selectedButton = useRef<HTMLButtonElement | null>(null);
  const scroll = useRef(0), wasSelected = useRef(false);
  const read = async (signal?: AbortSignal) => {
    const value = await workingRequest<ItemDestinations>(actor,
      `/api/frameworks/${encodeURIComponent(frameworkId)}/destinations?itemId=${encodeURIComponent(itemId)}`, "GET", undefined, signal);
    if (value.viewerUserId !== actor || value.frameworkId !== frameworkId || value.itemId !== itemId) throw new Error("Your Item context changed. Reload Progress before continuing.");
    return value;
  };
  const message = (cause: unknown) => cause instanceof WorkingRequestError && (cause.code === "UPDATE_SESSION_CONFLICT" || cause.code === "Unauthorized")
    ? "Your sign-in changed. Reload Progress before continuing." : cause instanceof Error ? cause.message : "Cards are unavailable. Please refresh.";
  useEffect(() => {
    live.current = true; const abort = new AbortController(); controller.current = abort;
    void read(abort.signal).then((value) => { if (!abort.signal.aborted) setData(value); },
      (cause) => { if (!abort.signal.aborted) setError(message(cause)); }).finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => { live.current = false; controller.current?.abort(); };
    // Dialog identity includes the actor, Framework and Item.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actor, frameworkId, itemId]);
  useEffect(() => {
    const dialog = content.current?.closest("dialog");
    if (selectedId) { if (dialog) dialog.scrollTop = 0; back.current?.focus({ preventScroll: true }); }
    else if (wasSelected.current) { selectedButton.current?.focus({ preventScroll: true }); if (dialog) dialog.scrollTop = scroll.current; }
    wasSelected.current = selectedId !== null;
  }, [selectedId]);
  const refresh = async () => {
    if (running.current) return;
    const abort = new AbortController(); controller.current?.abort(); controller.current = abort;
    setLoading(true); setError("");
    try { const value = await read(abort.signal); if (live.current && !abort.signal.aborted) { setData(value); setSelectedId(null); setArchived(null); } }
    catch (cause) { if (live.current && !abort.signal.aborted) setError(message(cause)); }
    finally { if (live.current && !abort.signal.aborted) setLoading(false); }
  };
  const navigate = async (card: ItemCardDestination, entry: ItemDeckContext, restore = false) => {
    if (running.current || !data) return;
    running.current = true; setPending(true); setError("");
    const abort = new AbortController(); controller.current?.abort(); controller.current = abort;
    try {
      await flushPersonalMutations();
      const latest = await read(abort.signal);
      const current = latest.cards.find((candidate) => candidate.cardTemplateId === card.cardTemplateId)?.contexts
        .find((candidate) => candidate.kind === entry.kind && candidate.deckTemplateId === entry.deckTemplateId);
      if (!current) throw new Error("This Card is no longer available in the selected Deck. Refresh Cards before continuing.");
      const href = entry.kind === "library"
        ? await progressLibraryHref(actor, entry, frameworkId, data.areaId, abort.signal, card.cardTemplateId)
        : await progressWorkingHref(actor, entry, current, frameworkId, data.areaId, restore, card.cardTemplateId);
      if (!live.current || abort.signal.aborted) return;
      onLeaving(); router.push(href);
    } catch (cause) { if (live.current && !abort.signal.aborted) setError(message(cause)); }
    finally { running.current = false; if (live.current) setPending(false); }
  };
  const select = (card: ItemCardDestination, event: MouseEvent<HTMLButtonElement>) => {
    selectedButton.current = event.currentTarget; scroll.current = event.currentTarget.closest("dialog")?.scrollTop ?? 0;
    if (card.contexts.length === 1 && card.contexts[0].kind !== "archived") { void navigate(card, card.contexts[0]); return; }
    setSelectedId(card.cardTemplateId);
    setArchived(card.contexts.length === 1 ? card.contexts[0] : null);
  };
  const selected = data?.cards.find((card) => card.cardTemplateId === selectedId);
  return <LibraryDialog title={title} className={`${styles.dialog} ${cardStyles.dialog}`} isolateInteractions onCancel={() => { if (!running.current) onClose(); }}>
    <button className={styles.close} type="button" disabled={pending} onClick={onClose}>Close</button>
    <div ref={content}>
      {loading ? <p role="status">Loading Cards…</p> : null}
      {error ? <p role="alert">{error} <button type="button" disabled={pending} onClick={() => void refresh()}>Refresh Cards</button></p> : null}
      {data?.state === "incomplete" && !error ? <p className={styles.notice} role="status">Some Card destinations are unavailable. {data.cards.length ? "Available choices are shown." : "No Card destinations can currently be shown."}
        <button type="button" disabled={pending || loading} onClick={() => void refresh()}>Refresh Cards</button></p> : null}
      {data?.state === "empty" ? <p className={styles.notice}>No Cards are available through accessible Decks for this Item.</p> : null}
      <div className={cardStyles.cards} hidden={!!selectedId}>{data?.cards.map((card) => <div key={card.cardTemplateId} data-card-template-id={card.cardTemplateId} className={cardStyles.choice}>
        <article className={`deck-card-surface deck-card-surface--front ${cardStyles.card}`}>
          <div className="deck-card-content"><ActiveCardFront card={card.presentation} dateLabel="" staticSelection /></div>
          <CardCreatorAttribution card={card.presentation} staticSelection />
          <button type="button" className={`${styles.select} ${cardStyles.select}`} disabled={pending || loading || !!error}
            aria-label={`Choose ${card.presentation.intro.title || "Untitled Card"}`} onClick={(event) => select(card, event)} />
        </article>
        <p className={`${styles.notice} ${cardStyles.caption}`}>
          {card.contexts.length === 1
            ? `${card.contexts[0].kind === "library" ? "Library" : card.contexts[0].kind === "archived" ? "Archived" : "My Decks"} · ${card.contexts[0].front.title}`
            : "Choose a Deck"}
          {card.versionsDiffer ? " · Different versions available" : ""}</p>
      </div>)}</div>
      {selected ? <div>
        <button ref={back} className={cardStyles.back} type="button" disabled={pending} onClick={() => { setSelectedId(null); setArchived(null); }}>Back to Cards</button>
        <p className={styles.notice}>Choose a Deck for {selected.presentation.intro.title || "this Card"}.</p>
        {(["active", "archived", "library"] as const).map((kind) => {
          const contexts = selected.contexts.filter((entry) => entry.kind === kind);
          if (!contexts.length) return null;
          return <section className={styles.section} key={kind}><h3>{kind === "active" ? "My Decks" : kind === "archived" ? "Archived" : "Library"} <span className={styles.count}>{contexts.length}</span></h3>
            <div className={styles.grid}>{contexts.map((entry) => <div key={entry.deckTemplateId} data-deck-template-id={entry.deckTemplateId} data-context={kind}>
              <article className={`deck-tile ${styles.tile}`}><DeckFrontContents front={entry.front} />
                <button type="button" className={styles.select} disabled={pending || loading || !!error}
                  aria-label={`${kind === "archived" ? "Select archived" : kind === "library" ? "Open Library" : "Open"} ${entry.front.title}`}
                  onClick={() => { if (entry.kind === "archived") setArchived(entry); else void navigate(selected, entry); }} />
              </article>
              <p className={styles.notice}>Card version {entry.cardVersion}</p>
              {archived?.deckTemplateId === entry.deckTemplateId && entry.kind === "archived" ? <div className={styles.actions}>
                <p>Restore this Deck and open it at the selected Card?</p>
                <button type="button" disabled={pending || !!error} onClick={() => void navigate(selected, entry, true)}>Restore and open</button>
                <button type="button" disabled={pending} onClick={() => setArchived(null)}>Cancel</button>
              </div> : null}
            </div>)}</div>
          </section>;
        })}
      </div> : null}
    </div>
  </LibraryDialog>;
}

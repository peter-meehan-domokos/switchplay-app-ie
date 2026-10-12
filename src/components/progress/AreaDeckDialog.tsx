"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import LibraryDialog from "@/components/library/LibraryDialog";
import DeckFrontContents from "@/components/decks/DeckFrontContents";
import { workingRequest, WorkingRequestError } from "@/components/decks/updateClient";
import { workingDeckHref } from "@/components/library/libraryClient";
import { flushPersonalMutations } from "@/lib/deckMutations";
import type { AreaDeckDestination, AreaDestinations, DestinationSection } from "@/lib/frameworks/destinations";
import { withProgressReturn } from "@/lib/frameworks/progressNavigation";
import styles from "./areaDialog.module.css";

function errorMessage(cause: unknown) {
  if (cause instanceof WorkingRequestError) return cause.code === "UPDATE_SESSION_CONFLICT" || cause.code === "Unauthorized"
    ? "Your sign-in changed. Reload Progress before continuing."
    : cause.code.includes("REVISION") ? "Your Deck membership changed. Refresh the list before continuing."
    : "Unable to confirm the current Deck state. Refresh Decks before trying again.";
  return cause instanceof Error ? cause.message : "Decks are unavailable.";
}

export default function AreaDeckDialog({ actor, frameworkId, areaId, title, onClose, onLeaving }: {
  actor: string; frameworkId: string; areaId: string; title: string; onClose(): void; onLeaving(): void;
}) {
  const router = useRouter(), running = useRef(false), live = useRef(true);
  const [data, setData] = useState<AreaDestinations>(), [error, setError] = useState("");
  const [loading, setLoading] = useState(true), [pending, setPending] = useState<string | null>(null);
  const [selected, setSelected] = useState<AreaDeckDestination | null>(null);
  const [expanded, setExpanded] = useState({ active: true, archived: false, library: false });
  const load = async (signal?: AbortSignal) => {
    const result = await workingRequest<AreaDestinations>(actor,
      `/api/frameworks/${encodeURIComponent(frameworkId)}/destinations?areaId=${encodeURIComponent(areaId)}`, "GET", undefined, signal);
    if (result.viewerUserId !== actor || result.frameworkId !== frameworkId || result.areaId !== areaId) throw new Error("Area destinations changed. Please try again.");
    return result;
  };
  useEffect(() => {
    live.current = true;
    const controller = new AbortController();
    void load(controller.signal).then((result) => { if (!controller.signal.aborted) { setData(result); setError(""); } },
      (cause: unknown) => { if (!controller.signal.aborted) setError(errorMessage(cause)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { live.current = false; controller.abort(); };
    // Each dialog is keyed by actor, Framework and Area.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actor, frameworkId, areaId]);
  const refresh = async () => {
    setLoading(true); setError("");
    try { const result = await load(); if (live.current) { setData(result); setSelected(null); } }
    catch (cause) { if (live.current) setError(errorMessage(cause)); }
    finally { if (live.current) setLoading(false); }
  };
  const open = async (entry: AreaDeckDestination, restore: boolean) => {
    if (running.current) return;
    running.current = true; setPending(entry.deckTemplateId); setError("");
    try {
      await flushPersonalMutations();
      const latest = await load();
      if (!live.current) return;
      setData(latest);
      const current = [...latest.myDecks.entries, ...latest.archived.entries].find((item) => item.deckTemplateId === entry.deckTemplateId);
      if (!current || current.availability !== "available" || current.kind !== entry.kind ||
        current.membershipRevision !== entry.membershipRevision || current.adoptedDeckVersion !== entry.adoptedDeckVersion)
        throw new Error("This Deck changed or is unavailable. Refresh the list before opening it.");
      if (restore) await workingRequest(actor, `/api/decks-data/${encodeURIComponent(entry.deckTemplateId)}`, "PATCH",
        { type: "restore", membershipRevision: entry.membershipRevision });
      if (!live.current) return;
      onLeaving();
      router.push(withProgressReturn(workingDeckHref(entry.deckTemplateId), { frameworkId, areaId, restored: restore }));
    } catch (cause) { if (live.current) setError(errorMessage(cause)); }
    finally { running.current = false; if (live.current) setPending(null); }
  };
  const renderSection = (kind: "active" | "archived", name: string, section?: DestinationSection) => <section className={styles.section} key={kind}>
    <h3><button type="button" className={styles.toggle} aria-expanded={expanded[kind]} aria-controls={`area-decks-${kind}`}
      onClick={() => setExpanded((state) => ({ ...state, [kind]: !state[kind] }))}>
      {name}<span className={styles.count}>{section?.count ?? "—"}</span><span aria-hidden="true">{expanded[kind] ? "⌄" : "›"}</span>
    </button></h3>
    <div id={`area-decks-${kind}`} hidden={!expanded[kind]}>
      {section?.state === "incomplete" ? <p className={styles.notice} role="status">Some Decks could not be checked. Available matches are shown; the total is unavailable.</p> : null}
      {section?.state === "empty" ? <p className={styles.notice}>No matching Decks.</p> : null}
      <div className={styles.grid}>{section?.entries.map((entry) => <div key={entry.deckTemplateId} data-destination={entry.deckTemplateId} data-context={kind}>
        <article className={`deck-tile ${styles.tile}`}>
          <DeckFrontContents front={entry.front} />
          <button type="button" className={styles.select} disabled={pending !== null || loading || !!error || entry.availability !== "available"}
            aria-label={`${kind === "active" ? "Open" : "Select archived"} ${entry.front.title}`}
            onClick={() => kind === "active" ? void open(entry, false) : setSelected(entry)} />
        </article>
        <span className={styles.matching}>{entry.matchingCardCount} matching {entry.matchingCardCount === 1 ? "Card" : "Cards"}</span>
        {entry.availability === "unavailable" ? <p className={styles.notice}>This Deck is currently unavailable.</p> : null}
        {selected?.deckTemplateId === entry.deckTemplateId && kind === "archived" ? <div className={styles.actions}>
          <p>Restore this Deck to your active workload and open it?</p>
          <button type="button" disabled={pending !== null || !!error} onClick={() => void open(entry, true)}>Restore and open</button>
          <button type="button" disabled={pending !== null} onClick={() => setSelected(null)}>Cancel</button>
        </div> : null}
      </div>)}</div>
    </div>
  </section>;
  return <LibraryDialog title={title} isolateInteractions className={styles.dialog} onCancel={() => { if (!running.current) onClose(); }}>
    <button type="button" className={styles.close} disabled={pending !== null} onClick={onClose}>Close</button>
    {loading ? <p role="status">Loading Decks…</p> : null}
    {error ? <p role="alert">{error} <button type="button" disabled={pending !== null} onClick={() => void refresh()}>Refresh Decks</button></p> : null}
    {!loading && !error && data && [data.myDecks, data.archived].some((section) => section.state === "incomplete") ?
      <button type="button" disabled={pending !== null} onClick={() => void refresh()}>Refresh Decks</button> : null}
    {renderSection("active", "My Decks", data?.myDecks)}
    {renderSection("archived", "Archived", data?.archived)}
    <section className={styles.section}><h3><button type="button" className={styles.toggle} aria-expanded={expanded.library} aria-controls="area-decks-library"
      onClick={() => setExpanded((state) => ({ ...state, library: !state.library }))}>
      Library<span className={styles.count}>—</span><span aria-hidden="true">{expanded.library ? "⌄" : "›"}</span>
    </button></h3><div id="area-decks-library" hidden={!expanded.library}><p className={styles.notice}>Library content will be available here in the next checkpoint.</p></div></section>
  </LibraryDialog>;
}

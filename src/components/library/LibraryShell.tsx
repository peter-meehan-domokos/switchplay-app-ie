"use client";
import { imageDeliveryUrl } from "@/lib/mediaDelivery";
import { forwardRef, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, LayoutGroup, motion, useIsPresent } from "motion/react";
import { useRouter, useSearchParams } from "next/navigation";
import DeckGrid from "@/components/decks/DeckGrid";
import DeckScene from "@/components/decks/DeckScene";
import DeckMenu from "@/components/decks/DeckMenu";
import FocusedCardView from "@/components/decks/FocusedCardView";
import OverviewMenu from "@/components/layout/OverviewMenu";
import type { LibraryCollectionDTO, LibraryViewerStatusDTO, LibraryCardDestination } from "@/lib/cards/libraryReadModels";
import type { LibraryEntry } from "@/lib/cards/libraryProjection";
import type { PersonalEntryResult } from "@/lib/cards/libraryEntry";
import type { PresentedCard } from "@/components/decks/presentation";
import { deckPresentationIdentity } from "@/components/decks/presentation";
import { deckEntryAction, libraryFetch, LibraryRequestError, workingDeckHref } from "./libraryClient";
import LibraryDialog from "./LibraryDialog";
import LibraryTabs from "./LibraryTabs";
import { progressReturnHref, readProgressReturn, withProgressReturn } from "@/lib/frameworks/progressNavigation";
import { flushPersonalMutations } from "@/lib/deckMutations";
import { useLibraryNavigation } from "./useLibraryNavigation";

const transition = { type: "spring", stiffness: 300, damping: 30 };
const LibraryView = forwardRef<HTMLDivElement, { children: ReactNode; detail: boolean }>(function LibraryView({ children, detail }, ref) {
  const present = useIsPresent();
  return <motion.div ref={ref} className="library-view" style={{ position: "relative", zIndex: detail ? 2 : 1 }}
    inert={!present} aria-hidden={!present || undefined}>
    {/* Motion retains the closing Deck's layout snapshot; its live players and
        preparation resources must still clean up as soon as we leave it. */}
    {present || !detail ? children : null}
  </motion.div>;
});
export default function LibraryShell({ initialCollection, initialEntry, currentUserId, userName }: {
  initialCollection?: LibraryCollectionDTO; initialEntry?: LibraryEntry; currentUserId: string; userName: string;
}) {
  const router = useRouter();
  const search = useSearchParams(), progressReturn = readProgressReturn(search);
  const requestedCard = search.get("openCard");
  const requestedVersion = search.get("cardVersion");
  const [status, setStatus] = useState<LibraryViewerStatusDTO | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [stale, setStale] = useState(false);
  const [previewGeneration, setPreviewGeneration] = useState(0);
  const [chooser, setChooser] = useState<{ cardId: string; destinations: LibraryCardDestination[] } | null>(null);
  const controller = useRef<AbortController | null>(null);
  const requestSequence = useRef(0);
  const statusEpoch = useRef(0);
  const actionRunning = useRef(false);
  useEffect(() => () => { requestSequence.current++; controller.current?.abort(); }, []);
  const current = useCallback(async (signal: AbortSignal) => {
    let auth;
    try { auth = await libraryFetch<{ user: { id: string } | null }>("/api/auth/me", signal); }
    catch (cause) { if (!signal.aborted && cause instanceof LibraryRequestError && cause.status === 401) router.refresh(); throw cause; }
    // A delayed response or browser Back after switching accounts cannot install
    // another viewer's status/actions into this session.
    if (auth.user?.id !== currentUserId) { router.refresh(); throw new LibraryRequestError(409, "LIBRARY_SESSION_CONFLICT"); }
  }, [currentUserId, router]);
  const resetSelection = useCallback(() => {
    ++requestSequence.current; ++statusEpoch.current; controller.current?.abort(); actionRunning.current = false;
    setStatus(null); setPending(null); setError(""); setStale(false); setChooser(null);
  }, [setStatus, setPending, setError, setStale, setChooser]);
  const busy = useCallback(() => actionRunning.current, []);
  const navigation = useLibraryNavigation({ initialCollection, initialEntry, assertCurrent: current,
    onNavigate: resetSelection, onError: setError, busy });
  const { collection, entry } = navigation;
  const active = entry?.availability === "available" ? entry : null;
  const readStatus = useCallback(async (selected: LibraryEntry | undefined, signal: AbortSignal) => {
    const query = new URLSearchParams();
    if (selected?.availability === "available") {
      query.append("deckTemplateId", selected.deckTemplateId);
      // Endpoint batches are bounded; a large Deck still gets every Card status.
      const cards = selected.manifest.cards;
      const batches = Math.max(1, Math.ceil(cards.length / 50));
      const values: LibraryViewerStatusDTO[] = [];
      for (let index = 0; index < batches; index++) {
        const batch = new URLSearchParams(query);
        for (const card of cards.slice(index * 50, (index + 1) * 50)) batch.append("cardTemplateId", card.cardTemplateId);
        values.push(await libraryFetch<LibraryViewerStatusDTO>(`/api/library/viewer-status?${batch}`, signal));
      }
      if (values.some((value) => value.viewerUserId !== currentUserId)) { router.refresh(); throw new Error("Your session changed. Reload Library before continuing."); }
      return { ...values[0], cards: values.flatMap((value) => value.cards) };
    }
    return null;
  }, [currentUserId, router]);
  useEffect(() => {
    const abort = new AbortController();
    let reading = false;
    const refreshStatus = () => {
      if (reading || actionRunning.current || document.visibilityState === "hidden") return;
      reading = true;
      const epoch = statusEpoch.current;
      void readStatus(entry, abort.signal).then(async (value) => {
        await current(abort.signal);
        // Background status cannot overwrite a completed Add/Restore result.
        if (!abort.signal.aborted && epoch === statusEpoch.current) setStatus(value);
      }).catch((cause) => {
        if (!abort.signal.aborted && epoch === statusEpoch.current) setError(cause instanceof Error ? cause.message : "Unable to load Library status.");
      }).finally(() => { reading = false; });
    };
    refreshStatus();
    window.addEventListener("focus", refreshStatus);
    window.addEventListener("pageshow", refreshStatus);
    document.addEventListener("visibilitychange", refreshStatus);
    return () => {
      abort.abort();
      window.removeEventListener("focus", refreshStatus);
      window.removeEventListener("pageshow", refreshStatus);
      document.removeEventListener("visibilitychange", refreshStatus);
    };
  }, [entry, readStatus, current]);
  async function perform(label: string, operation: (signal: AbortSignal) => Promise<void>) {
    if (actionRunning.current) return;
    actionRunning.current = true; statusEpoch.current++;
    const token = ++requestSequence.current, abort = new AbortController(); controller.current?.abort(); controller.current = abort;
    setPending(label); setError("");
    try { await current(abort.signal); await operation(abort.signal); }
    catch (cause) {
      if (abort.signal.aborted || token !== requestSequence.current) return;
      if (cause instanceof LibraryRequestError && cause.code === "LIBRARY_PREVIEW_CONFLICT") setStale(true);
      else { if (cause instanceof LibraryRequestError && (cause.status === 401 || cause.code === "LIBRARY_SESSION_CONFLICT")) router.refresh(); setError(cause instanceof Error ? cause.message : "Library request failed. Please retry."); }
    } finally { if (token === requestSequence.current) { if (!abort.signal.aborted) setPending(null); actionRunning.current = false; } }
  }
  const membership = status?.decks.find((data) => data.deckTemplateId === active?.deckTemplateId);
  async function primaryAction() {
    if (!active || !membership || !navigation.verified || navigation.checking) return;
    if (membership.state === "active") { await perform("open", async (signal) => { await current(signal); if (!signal.aborted) router.push(withProgressReturn(workingDeckHref(active.deckTemplateId), progressReturn)); }); return; }
    await perform(membership.state === "archived" ? "restore" : "add", async (signal) => {
      const result = await libraryFetch<PersonalEntryResult>(`/api/library/decks/${encodeURIComponent(active.deckTemplateId)}/${membership.state === "archived" ? "restore" : "add"}`, signal,
        membership.state === "archived" ? { membershipRevision: membership.membershipRevision } : { manifest: active.manifest }, currentUserId);
      await current(signal);
      if (result.viewerUserId !== currentUserId) throw new Error("Your session changed. Reload Library before continuing.");
      const next = await readStatus(active, signal); await current(signal); if (!signal.aborted) setStatus(next);
    });
  }
  async function openCard(cardId: string, destination?: string) {
    await perform("open-card", async (signal) => {
      const next = await readStatus(active!, signal); await current(signal);
      if (signal.aborted) return;
      setStatus(next);
      const choices = next?.cards.find((card) => card.cardTemplateId === cardId)?.activeDecks ?? [];
      if (destination) {
        if (!choices.some((deck) => deck.deckTemplateId === destination)) { setChooser(null); throw new Error("That Deck is no longer available for this Card."); }
        router.push(withProgressReturn(workingDeckHref(destination, cardId), progressReturn));
      } else if (choices.length === 1) router.push(withProgressReturn(workingDeckHref(choices[0].deckTemplateId, cardId), progressReturn));
      else if (choices.length > 1) setChooser({ cardId, destinations: choices });
      else throw new Error("This Card is no longer in an active Deck in My Decks.");
    });
  }
  function cardAction(card: PresentedCard) {
    const data = status?.cards.find((item) => item.cardTemplateId === card.cardTemplateId);
    if (!data?.activeDecks.length || !navigation.verified) return null;
    return <button className="library-card-open" disabled={pending !== null} onClick={() => void openCard(data.cardTemplateId)} type="button">Open Card in My Decks</button>;
  }
  async function refreshPreview() {
    if (!entry) return;
    await perform("refresh", async (signal) => {
      const next = await libraryFetch<LibraryEntry>(`/api/library/decks/${encodeURIComponent(entry.deckTemplateId)}`, signal);
      await current(signal);
      if (signal.aborted) return;
      setStatus(null); navigation.acceptEntry(next); setPreviewGeneration((generation) => generation + 1); setStale(false); setChooser(null);
    });
  }
  const backToLibrary = () => navigation.select(null);
  if (navigation.sessionChanged) return <main className="app-shell"><p role="alert">Your session changed. Reload Library before continuing.</p><button type="button" onClick={() => router.refresh()}>Reload Library</button></main>;
  return <LayoutGroup id={`library-${currentUserId}`}>
    {/* Keep document scroll coordinates stable while the Deck occupies its fixed
        viewport. Otherwise the browser clamps scroll before Motion can project
        the selected tile, making lower-page Decks fly in from off screen. */}
    {entry && navigation.listHeight > 0 && <div aria-hidden="true" style={{ height: navigation.listHeight }} />}
    <main className={`app-shell library-shell${entry ? " app-shell--deck" : ""}`}>
    <AnimatePresence initial={false} mode="popLayout">
    <LibraryView key={entry ? `deck-${entry.deckTemplateId}` : "collection"} detail={!!entry}>
    {!entry && <><OverviewMenu username={userName} userId={currentUserId} /><header className="overview-header"><p className="eyebrow">{userName}</p><h1>Library</h1></header><LibraryTabs active="decks" /></>}
    {error && !stale && !chooser && <p className="library-error" role="alert">{error}{!status && <button type="button" onClick={() => window.location.reload()}>Reload Library</button>}</p>}
    {navigation.changed && <p className="library-error" role="status">A newer publication is available. <button type="button" disabled={pending !== null} onClick={() => void refreshPreview()}>Refresh preview</button></p>}
    {active && requestedCard && !active.deck.cards.some((card) => card.cardTemplateId === requestedCard &&
      (requestedVersion === null || String(card.version) === requestedVersion)) ? <section className="library-unavailable">
      <button type="button" className="back-button" onClick={() => progressReturn ? router.push(progressReturnHref(progressReturn), { scroll: false }) : backToLibrary()}>{progressReturn ? "Back to Progress" : "Back to Library"}</button>
      <h1>Unavailable Card</h1><p>The selected Card or publication changed. Return to Progress and refresh your choices. Your personal state has not changed.</p>
    </section> : active ? <>
      <DeckScene key={`${currentUserId}:${deckPresentationIdentity(active.deck)}:${previewGeneration}`} deck={active.deck} playbackViewerUserId={currentUserId} transition={transition} initialCardTemplateId={requestedCard ?? undefined}
        backLabel={progressReturn ? "Back to Progress" : "Back"}
        onBack={() => {
          if (!progressReturn) { backToLibrary(); return; }
          void perform("back", async (signal) => {
            await flushPersonalMutations();
            if (!signal.aborted) router.push(progressReturnHref(progressReturn), { scroll: false });
          });
        }} cardActions={cardAction}
        deckActions={<DeckMenu deckId={active.deckTemplateId} deckTemplateId={active.deckTemplateId}
          showEdit={!!membership?.canEditInCreator && navigation.verified}
          membershipAction={{ label: pending === "add" ? "Adding to My Decks…" : pending === "restore" ? "Restoring to My Decks…" : !membership ? "Loading…" : deckEntryAction(membership.state),
            disabled: !membership || pending !== null || !navigation.verified || navigation.checking, onSelect: () => void primaryAction() }}
          editHref={`/creator/edit/${encodeURIComponent(active.deckTemplateId)}?${new URLSearchParams({ returnTo: "library", returnDeckId: active.deckTemplateId,
            version: String(active.manifest.deckVersion), cards: JSON.stringify(active.manifest.cards) })}`} />}
        renderFocusedCard={(props) => <FocusedCardView {...props} playbackViewerUserId={currentUserId} overlays={cardAction(props.card)} />} />
    </> : entry ? <section className="library-unavailable"><button type="button" className="back-button" onClick={() => progressReturn ? router.push(progressReturnHref(progressReturn), { scroll: false }) : backToLibrary()}>{progressReturn ? "Back to Progress" : "Back to Library"}</button><h1>Unavailable Deck</h1><p>This public Deck cannot currently be previewed.</p></section> : <>
      {navigation.loading && <p role="status">Loading Library…</p>}
      <DeckGrid orderedEntries={(collection?.entries ?? []).map((item) => item.availability === "available" ? item.deck : {
        id: item.deckTemplateId, unavailable: <div className="deck-tile library-unavailable-tile"><button type="button" onClick={() => navigation.select(item.deckTemplateId)}>Unavailable Deck</button><p>Public content needs attention.</p></div>,
      })} decks={(collection?.entries ?? []).flatMap((item) => item.availability === "available" ? [item.deck] : [])}
        instantiatingDeckTemplateId={null} isInteractionLocked={pending !== null} transition={transition}
        onSelectDeck={(id) => navigation.select(id)} />
      {collection?.entries.length === 0 && <p>No public Decks yet.</p>}
      {collection?.nextCursor && <button type="button" disabled={pending !== null} onClick={() => void perform("more", async (signal) => {
        const next = await libraryFetch<LibraryCollectionDTO>(`/api/library/decks?cursor=${encodeURIComponent(collection.nextCursor!)}`, signal);
        await current(signal);
        if (!signal.aborted) navigation.appendPage(next);
      })}>More Decks</button>}
    </>}
    </LibraryView>
    </AnimatePresence>
    {stale && <LibraryDialog title="Preview has changed" onCancel={() => { if (!pending) setStale(false); }}>{error && <p role="alert">{error}</p>}<p>This Deck or one of its Cards has a newer publication. Refresh the preview before adding.</p><button type="button" disabled={pending !== null} onClick={() => void refreshPreview()}>Refresh preview</button><button type="button" disabled={pending !== null} onClick={() => setStale(false)}>Cancel</button></LibraryDialog>}
    {chooser && <LibraryDialog title="Open Card in My Decks" onCancel={() => { if (!pending) setChooser(null); }}>{error && <p role="alert">{error}</p>}<p>Choose the Deck to open.</p>{chooser.destinations.map((deck) => <button className="library-destination" data-deck-template-id={deck.deckTemplateId} key={deck.deckTemplateId} type="button" disabled={pending !== null} onClick={() => void openCard(chooser.cardId, deck.deckTemplateId)}>
      {deck.introduction?.image && <span className="library-destination-cover" style={{ backgroundImage: `url(${JSON.stringify(imageDeliveryUrl(deck.introduction.image.src))})` }} role="img" aria-label={deck.introduction.image.description || "Deck cover"} />}
      <span>{deck.title}<small>{deck.creatorUsername}</small></span>
    </button>)}<button type="button" disabled={pending !== null} onClick={() => setChooser(null)}>Cancel</button></LibraryDialog>}
  </main></LayoutGroup>;
}

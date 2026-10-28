"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { LibraryCollectionDTO } from "@/lib/cards/libraryReadModels";
import type { LibraryEntry } from "@/lib/cards/libraryProjection";
import { libraryFetch, LibraryRequestError } from "./libraryClient";

const FRESH_MS = 60_000;
const MAX_DETAILS = 5;
const unavailable = (id: string): LibraryEntry => ({ availability: "unavailable", deckTemplateId: id,
  title: "Unavailable Deck", publishedAt: null, reason: "PUBLIC_CONTENT_UNAVAILABLE" });
const publication = (entry: LibraryEntry) => entry.availability === "available" ? JSON.stringify(entry.manifest) : "unavailable";
function routeDeck(path: string) {
  const match = /^\/library\/([^/]+)\/?$/.exec(path);
  try { return match ? decodeURIComponent(match[1]) : null; } catch { return null; }
}

// This is the mounted Library's own presentation state, not a shared/persistent
// content cache. All reads and actions still use the authenticated Library APIs.
export function useLibraryNavigation({ initialCollection, initialEntry, assertCurrent, onNavigate, onError, busy }: {
  initialCollection?: LibraryCollectionDTO; initialEntry?: LibraryEntry;
  assertCurrent: (signal: AbortSignal) => Promise<void>; onNavigate: () => void;
  onError: (error: string) => void; busy: () => boolean;
}) {
  const pathname = usePathname();
  const [collection, setCollection] = useState(initialCollection);
  const [entry, setEntry] = useState(initialEntry);
  const [checking, setChecking] = useState(false);
  const [verified, setVerified] = useState(initialEntry?.availability === "available");
  const [changed, setChanged] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sessionChanged, setSessionChanged] = useState(false);
  const [listHeight, setListHeight] = useState(0);
  const details = useRef(new Map<string, LibraryEntry>(initialEntry ? [[initialEntry.deckTemplateId, initialEntry]] : []));
  const current = useRef({ collection, entry });
  useLayoutEffect(() => { current.current = { collection, entry }; }, [collection, entry]);
  const selected = useRef(initialEntry?.deckTemplateId ?? null);
  const scroll = useRef(0);
  const restoreScroll = useRef(false);
  const lastPath = useRef(pathname);
  const pages = useRef(1);
  const lastCollectionRead = useRef(0);
  useEffect(() => { if (initialCollection) lastCollectionRead.current = Date.now(); }, [initialCollection]);
  const detailRead = useRef<AbortController | null>(null);
  const collectionRead = useRef<AbortController | null>(null);
  const sequence = useRef(0);

  const remember = useCallback((value: LibraryEntry) => {
    details.current.delete(value.deckTemplateId); details.current.set(value.deckTemplateId, value);
    while (details.current.size > MAX_DETAILS) details.current.delete(details.current.keys().next().value!);
  }, []);
  const patchCollection = useCallback((value: LibraryEntry, remove = false) => {
    setCollection(previous => previous ? { ...previous, entries: remove
      ? previous.entries.filter(item => item.deckTemplateId !== value.deckTemplateId)
      : previous.entries.map(item => item.deckTemplateId === value.deckTemplateId ? value : item) } : previous);
  }, []);
  const failed = useCallback((cause: unknown) => {
    if (cause instanceof LibraryRequestError && (cause.status === 401 || cause.code === "LIBRARY_SESSION_CONFLICT")) {
      details.current.clear(); setCollection(undefined); setEntry(undefined); setSessionChanged(true);
    }
    onError(cause instanceof Error ? cause.message : "Unable to refresh Library. Please retry.");
  }, [onError]);

  const validate = useCallback(async (id: string) => {
    detailRead.current?.abort();
    const abort = new AbortController(), token = ++sequence.current;
    detailRead.current = abort; setChecking(true); setVerified(false);
    try {
      const value = await libraryFetch<LibraryEntry>(`/api/library/decks/${encodeURIComponent(id)}`, abort.signal);
      await assertCurrent(abort.signal);
      if (abort.signal.aborted || token !== sequence.current || selected.current !== id) return;
      remember(value); patchCollection(value);
      const displayed = current.current.entry;
      setVerified(value.availability === "available" && (!displayed || publication(displayed) === publication(value)));
      if (!displayed || displayed.deckTemplateId !== id || value.availability === "unavailable") setEntry(value);
      else setChanged(publication(displayed) !== publication(value));
    } catch (cause) {
      if (abort.signal.aborted || token !== sequence.current) return;
      if (cause instanceof LibraryRequestError && (cause.status === 403 || cause.status === 404)) {
        details.current.delete(id); patchCollection(unavailable(id), true); setEntry(unavailable(id));
      } else failed(cause);
    } finally {
      if (!abort.signal.aborted && token === sequence.current) { setChecking(false); setLoading(false); }
    }
  }, [assertCurrent, failed, patchCollection, remember]);

  const refreshCollection = useCallback(async () => {
    if (collectionRead.current) return;
    const abort = new AbortController(); collectionRead.current = abort;
    if (!current.current.collection) setLoading(true);
    try {
      let cursor: string | null = null;
      const entries: LibraryEntry[] = [];
      // Re-read the loaded prefix, using fresh cursors. Pagination is never reset
      // to the first page or partially replaced while a refresh is in flight.
      let loadedPages = 0;
      for (let page = 0; page < pages.current; page++) {
        const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
        const value: LibraryCollectionDTO = await libraryFetch(`/api/library/decks${query}`, abort.signal);
        entries.push(...value.entries.filter(item => !entries.some(old => old.deckTemplateId === item.deckTemplateId)));
        loadedPages++;
        cursor = value.nextCursor;
        if (!cursor) break;
      }
      await assertCurrent(abort.signal);
      if (abort.signal.aborted) return;
      setCollection({ entries, nextCursor: cursor }); pages.current = loadedPages; lastCollectionRead.current = Date.now();
    } catch (cause) { if (!abort.signal.aborted) failed(cause); }
    finally { if (collectionRead.current === abort) { collectionRead.current = null; setLoading(false); } }
  }, [assertCurrent, failed]);

  const select = useCallback((id: string | null, writeHistory = true) => {
    if (selected.current === id) return;
    if (selected.current === null && id) {
      scroll.current = window.scrollY;
      setListHeight(document.documentElement.scrollHeight);
    }
    onNavigate(); detailRead.current?.abort(); ++sequence.current;
    // A collection snapshot started before selection must not overwrite the
    // newer detail validation (or its access/availability result) afterwards.
    if (id) { collectionRead.current?.abort(); collectionRead.current = null; }
    selected.current = id; setChanged(false); setChecking(!!id); setVerified(false);
    restoreScroll.current = id === null;
    const next = id ? current.current.collection?.entries.find(item => item.deckTemplateId === id) ?? details.current.get(id) : undefined;
    setEntry(next); setLoading(!!id && !next);
    if (writeHistory) window.history.pushState(null, "", id ? `/library/${encodeURIComponent(id)}` : "/library");
    if (id) { if (next) remember(next); void validate(id); }
    else if (!current.current.collection || Date.now() - lastCollectionRead.current >= FRESH_MS) void refreshCollection();
  }, [onNavigate, refreshCollection, remember, validate]);

  useLayoutEffect(() => {
    if (pathname === lastPath.current) return;
    lastPath.current = pathname;
    const id = routeDeck(pathname);
    if (id !== selected.current) select(id, false);
  }, [pathname, select]);
  useLayoutEffect(() => {
    if (!entry && collection && selected.current === null && restoreScroll.current) {
      restoreScroll.current = false; window.scrollTo({ top: scroll.current, behavior: "instant" });
    }
  }, [entry, collection]);
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "hidden" || busy()) return;
      if (selected.current) void validate(selected.current);
      else if (Date.now() - lastCollectionRead.current >= FRESH_MS) void refreshCollection();
    };
    const timer = window.setInterval(refresh, FRESH_MS);
    window.addEventListener("focus", refresh); window.addEventListener("pageshow", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer); window.removeEventListener("focus", refresh); window.removeEventListener("pageshow", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [busy, refreshCollection, validate]);
  useEffect(() => () => { ++sequence.current; detailRead.current?.abort(); collectionRead.current?.abort(); }, []);

  function acceptEntry(value: LibraryEntry) {
    detailRead.current?.abort(); ++sequence.current; remember(value); patchCollection(value);
    if (selected.current === value.deckTemplateId) { setEntry(value); setChanged(false); setChecking(false); setVerified(value.availability === "available"); }
  }
  function appendPage(value: LibraryCollectionDTO) {
    collectionRead.current?.abort(); collectionRead.current = null;
    pages.current++; lastCollectionRead.current = Date.now();
    setCollection(previous => ({ ...previous, entries: [...(previous?.entries ?? []), ...value.entries.filter(item =>
      !previous?.entries.some(old => old.deckTemplateId === item.deckTemplateId))], nextCursor: value.nextCursor }));
  }
  return { collection, entry, checking, verified, changed, loading, sessionChanged, listHeight, select, acceptEntry, appendPage };
}

"use client";
import { workingRequest, WorkingRequestError } from "@/components/decks/updateClient";
import { personalWork } from "@/lib/cards/personalWork";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import OverviewMenu from "./OverviewMenu";
import DeckGrid from "@/components/decks/DeckGrid";
import DeckDetail from "@/components/decks/DeckDetail";
import { buildDeckLayout } from "@/components/decks/deckLayout";
import { buildMyDecksLayout } from "@/components/decks/myDecksLayout";
import type { Deck } from "@/components/decks/types";
import type { MembershipDTO } from "@/lib/cards/readModels";
import { getTodayDateOnly } from "@/lib/dateOnly";
import { workingCardStore } from "@/lib/cards/workingCardStore";
import { canPresentWorkingMembership, type WorkingPresentationFreshness } from "@/lib/cards/workingEntry";
import { flushPersonalMutations } from "@/lib/deckMutations";
import { progressReturnHref, readProgressReturn, withProgressReturn } from "@/lib/frameworks/progressNavigation";
const transition = { type: "spring", stiffness: 300, damping: 30 };
type AppShellProps = { memberships: MembershipDTO[]; currentUserId: string; userName: string };
export default function AppShell(props: AppShellProps) {
  // A different learner never inherits a mounted working controller or request.
  return <WorkingShell key={props.currentUserId} {...props} />;
}
function WorkingShell({ memberships, currentUserId, userName }: AppShellProps) {
  const router = useRouter(), search = useSearchParams();
  const progressReturn = readProgressReturn(search);
  const [records, setRecords] = useState(memberships);
  const [selected, setSelected] = useState<Deck | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [rotation, setRotation] = useState(0);
  const [verified, setVerified] = useState(true);
  const [entryRevision, setEntryRevision] = useState(0);
  const [retryEntry, setRetryEntry] = useState<{ id: string; card?: string; fromUrl: boolean } | null>(null);
  const freshness = useRef<WorkingPresentationFreshness>({ actor: currentUserId, at: 0, epoch: workingCardStore.epoch(currentUserId) });
  // Serialize opening requests. Leaving a view does not undo a submitted write;
  // transport failures retain an uncertain outcome and require explicit Retry.
  const openTail = useRef<Promise<void>>(Promise.resolve());
  const selectedLayout = useMemo(() => selected ? buildDeckLayout(selected, { currentUserId, users: [{ id: currentUserId, name: userName }] }) : null, [selected, currentUserId, userName]);
  const actorRef = useRef(currentUserId);
  const refreshGeneration = useRef(0);
  const live = useRef(true);
  useEffect(() => {
    actorRef.current = currentUserId; live.current = true;
    freshness.current = { actor: currentUserId, at: Date.now(), epoch: workingCardStore.epoch(currentUserId) };
    return () => { live.current = false; };
  }, [currentUserId]);
  const openedParam = useRef<string | null>(null);
  const active = records.filter((item) => item.archivedAt === null);
  const decks = buildMyDecksLayout(active.flatMap((item) => item.display ? [buildDeckLayout(item.display, { currentUserId, users: [{ id: currentUserId, name: userName }] })] : []));
  const opening = useRef<{ actor: string; id: string; requestKey: string; generation: number } | null>(null);
  function acceptRecords(values: MembershipDTO[]) {
    setRecords(values);
    freshness.current = { actor: currentUserId, at: Date.now(), epoch: workingCardStore.epoch(currentUserId) };
  }
  async function open(id: string, cardTemplateId?: string, fromUrl = false) {
    const expectedVersion = fromUrl ? new URLSearchParams(window.location.search).get("cardVersion") : null;
    const requestKey = JSON.stringify([id, cardTemplateId, expectedVersion]);
    if (opening.current?.actor === currentUserId && opening.current.requestKey === requestKey) return;
    const generation = ++refreshGeneration.current;
    const token = { actor: currentUserId, id, requestKey, generation };
    opening.current = token;
    setPending(id); setError(""); setVerified(false); setRetryEntry({ id, card: cardTemplateId, fromUrl });
    const membership = records.find(item => item.deckTemplateId === id);
    const retainingFailedEntry = !fromUrl && selected?.deckTemplateId === id && !verified;
    const warm = !fromUrl && canPresentWorkingMembership(membership, currentUserId, freshness.current);
    if (!retainingFailedEntry) {
      if (warm) { setSelected(membership!.display!); setRotation(0); }
      else setSelected(null);
    }
    const stillRequested = () => {
      const query = new URLSearchParams(window.location.search);
      return opening.current === token && refreshGeneration.current === generation && actorRef.current === currentUserId && live.current
        && (!fromUrl || query.get("openDeck") === id && (query.get("openCard") ?? undefined) === cardTemplateId && query.get("cardVersion") === expectedVersion);
    };
    const previousOpen = openTail.current;
    // Include the post-request account check in the barrier. Superseded results
    // are ignored, and later opens wait for this request to finish.
    const operation = (async () => {
      try {
        await previousOpen;
        if (!stillRequested()) return;
        if (expectedVersion !== null && (!cardTemplateId || !/^[1-9]\d*$/.test(expectedVersion) || !Number.isSafeInteger(Number(expectedVersion)))) throw new Error("The selected Card version is invalid. Return to Progress and refresh your choices.");
        await flushPersonalMutations();
        const current = fromUrl ? await workingRequest<MembershipDTO[]>(currentUserId, "/api/decks-data") : records;
        if (!stillRequested()) return;
        if (fromUrl) acceptRecords(current);
        const membership = current.find(item => item.deckTemplateId === id && item.archivedAt === null);
        if (!membership || membership.availability === "unavailable") throw new Error("This Deck cannot currently be opened. Your membership and personal state are retained.");
        const scope = { userId: currentUserId, deckId: id, cardIds: membership.display?.cards.map(card => card.id) ?? [] };
        await personalWork.wait(scope);
        if (!stillRequested()) return;
        const epoch = workingCardStore.epoch(currentUserId), revision = personalWork.revision(scope);
        const deck = await workingRequest<Deck>(currentUserId, "/api/decks-data", "POST", { deckTemplateId: id, localDate: getTodayDateOnly(), ...(cardTemplateId ? { cardTemplateId } : {}), ...(expectedVersion === null ? {} : { expectedCardVersion: Number(expectedVersion) }) });
        if (!stillRequested()) return;
        if (workingCardStore.epoch(currentUserId) !== epoch || personalWork.hasWork(scope) || personalWork.revision(scope) !== revision) throw new Error("Personal state changed while checking this Deck. Retry opening to load its current state.");
        if (expectedVersion !== null && deck.cards.find(card => card.cardTemplateId === cardTemplateId)?.adoptedVersion !== Number(expectedVersion)) throw new Error("The selected Card version changed. Return to Progress and refresh your choices.");
        workingCardStore.accept(currentUserId, buildDeckLayout(deck, { currentUserId, users: [] }).cards);
        openedParam.current = JSON.stringify([currentUserId, id, null, null]);
        setSelected(deck); setEntryRevision(generation); setVerified(true); setRetryEntry(null);
        window.history.replaceState(null, "", withProgressReturn(`/decks?openDeck=${encodeURIComponent(id)}`, progressReturn ? { ...progressReturn, restored: false } : null));
      } catch (cause) {
        if (!stillRequested()) return;
        freshness.current.at = 0;
        if (cause instanceof WorkingRequestError && (cause.code.includes("FORBIDDEN") || ["Unauthorized", "UPDATE_SESSION_CONFLICT", "WORKING_DECK_REQUIRED", "MISSING_DECK_REFERENCE", "MISSING_CARD_REFERENCE", "MISSING_CARD_DATA", "MISSING_DECK_VERSION", "MISSING_CARD_VERSION"].includes(cause.code))) {
          setSelected(null);
          if (cause.code === "Unauthorized" || cause.code === "UPDATE_SESSION_CONFLICT") {
            setRecords([]); workingCardStore.clearUser(currentUserId); router.refresh();
          }
        }
        setError((progressReturn?.restored ? "The Deck was restored, but opening failed. Retry opening or return to Progress. " : "") +
          (cause instanceof WorkingRequestError && cause.code === "TARGET_CARD_VERSION_CONFLICT" ? "The selected Card version changed. Return to Progress and refresh your choices."
            : cause instanceof Error ? cause.message : "Unable to open Deck"));
      } finally {
        if (opening.current === token) {
          opening.current = null;
          if (actorRef.current === currentUserId && live.current && refreshGeneration.current === generation) setPending(null);
        }
      }
    })();
    openTail.current = operation;
    await operation;
  }
  useEffect(() => {
    const id = search.get("openDeck"), card = search.get("openCard");
    const key = JSON.stringify([currentUserId, id, card, search.get("cardVersion")]);
    if (id && openedParam.current !== key) {
      openedParam.current = key; void open(id, card ?? undefined, true);
    }
  });
  async function membershipAction(id: string, type: "archive" | "restore") {
    if (pending) return false;
    const generation = ++refreshGeneration.current;
    setPending(id); setError("");
    try { await flushPersonalMutations(); await workingRequest(currentUserId, `/api/decks-data/${encodeURIComponent(id)}`, "PATCH", { type,
      ...(type === "restore" ? { membershipRevision: records.find((item) => item.deckTemplateId === id)?.membershipRevision } : {}) });
      const next = await workingRequest<MembershipDTO[]>(currentUserId, "/api/decks-data");
      if (!live.current || actorRef.current !== currentUserId || generation !== refreshGeneration.current) return false;
      acceptRecords(next); setSelected(null);
      if (progressReturn && type === "archive") router.push(progressReturnHref(progressReturn), { scroll: false });
      else window.history.replaceState(null, "", "/decks");
      return true; }
    catch (error) { if (live.current && actorRef.current === currentUserId && generation === refreshGeneration.current) setError(error instanceof Error ? error.message : "Membership update failed"); return false; }
    finally { if (live.current && actorRef.current === currentUserId && generation === refreshGeneration.current) setPending(null); }
  }
  async function refreshWorking(command?: import("@/lib/cards/updateAdoption").UpdateCommand) {
    if (!selected || !verified || opening.current) return;
    const beforeWaiting = refreshGeneration.current;
    const id = selected.deckTemplateId;
    const scope = { userId: currentUserId, ...(command?.kind === "card" ? {} : { deckId: id }), cardIds: command?.kind === "card" ? [command.entityId] : selected.cards.map((card) => card.id) };
    if (!command && personalWork.isLocked(scope)) return;
    await personalWork.wait(scope);
    if (!command && personalWork.isLocked(scope)) return;
    if (!live.current || actorRef.current !== currentUserId || refreshGeneration.current !== beforeWaiting) {
      if (!command) return;
      throw new Error("Working state changed during refresh. Retry to load the current state.");
    }
    const generation = ++refreshGeneration.current;
    const epoch = workingCardStore.epoch(currentUserId);
    const workRevision = personalWork.revision(scope);
    const [projection, membershipRecords] = await Promise.all([
      command?.kind === "deck" ? workingRequest<Deck>(currentUserId, "/api/decks-data", "POST", { deckTemplateId: id, localDate: getTodayDateOnly() }) : workingRequest<Deck>(currentUserId, `/api/decks-data/${encodeURIComponent(id)}`),
      workingRequest<MembershipDTO[]>(currentUserId, "/api/decks-data"),
    ]);
    // Focus is a read, not another opening. Only an externally adopted Deck
    // composition needs normal open initialization for its newly introduced Cards.
    const deck = !command && projection.adoptedVersion !== selected.adoptedVersion
      ? await workingRequest<Deck>(currentUserId, "/api/decks-data", "POST", { deckTemplateId: id, localDate: getTodayDateOnly() }) : projection;
    if (!live.current || actorRef.current !== currentUserId || refreshGeneration.current !== generation || workingCardStore.epoch(currentUserId) !== epoch || personalWork.hasWork(scope) || personalWork.revision(scope) !== workRevision) {
      if (!command) return; // Obsolete background data must not replace optimistic work.
      throw new Error("Working state changed during refresh. Retry to load the current state.");
    }
    workingCardStore.accept(currentUserId, buildDeckLayout(deck, { currentUserId, users: [] }).cards);
    setSelected(deck); acceptRecords(membershipRecords);
  }
  useEffect(() => {
    let reading = false;
    const refresh = () => {
      if (!selected || !verified || opening.current || reading || document.visibilityState === "hidden") return;
      reading = true;
      void refreshWorking().catch((error) => setError(error instanceof Error ? error.message : "Unable to refresh My Decks")).finally(() => { reading = false; }); };
    const visibility = () => { if (document.visibilityState === "hidden") freshness.current.at = 0; else refresh(); };
    const blur = () => { freshness.current.at = 0; };
    window.addEventListener("blur", blur); window.addEventListener("focus", refresh); window.addEventListener("pageshow", refresh); document.addEventListener("visibilitychange", visibility);
    return () => { window.removeEventListener("blur", blur); window.removeEventListener("focus", refresh); window.removeEventListener("pageshow", refresh); document.removeEventListener("visibilitychange", visibility); };
  });
  async function close() {
    const generation = ++refreshGeneration.current;
    opening.current = null;
    if (!verified) {
      // No edits were enabled. Unmount players/editors immediately; never let a
      // late open response reopen this Deck or change its URL.
      freshness.current.at = 0;
      setSelected(null); setPending(null); setRetryEntry(null); setError("");
      if (progressReturn) router.push(progressReturnHref(progressReturn), { scroll: false });
      else { openedParam.current = null; window.history.replaceState(null, "", "/decks"); }
      return;
    }
    try {
      await flushPersonalMutations();
      const scope = { userId: currentUserId, deckId: selected?.deckTemplateId, cardIds: selected?.cards.map(card => card.id) ?? [] };
      if (selected) await personalWork.wait(scope);
      if (!live.current || actorRef.current !== currentUserId || generation !== refreshGeneration.current) return;
      if (progressReturn) { router.push(progressReturnHref(progressReturn), { scroll: false }); return; }
      const epoch = workingCardStore.epoch(currentUserId), revision = personalWork.revision(scope);
      const next = await workingRequest<MembershipDTO[]>(currentUserId, "/api/decks-data");
      if (!live.current || actorRef.current !== currentUserId || generation !== refreshGeneration.current) return;
      if (workingCardStore.epoch(currentUserId) !== epoch || personalWork.hasWork(scope) || personalWork.revision(scope) !== revision) throw new Error("Personal state changed while closing. Finish your changes and try Back again.");
      acceptRecords(next); setSelected(null); setError(""); openedParam.current = null; window.history.replaceState(null, "", "/decks");
    }
    catch (error) { if (live.current && actorRef.current === currentUserId && generation === refreshGeneration.current) setError(error instanceof Error ? error.message : "Some changes could not be saved"); }
  }
  return <main className={`app-shell${selected ? " app-shell--deck" : ""}`} data-working-ready={selected ? verified : undefined}>
    {selected && !verified ? <div className="working-entry-status">
      {pending ? <span role="status">Checking Deck… You can browse while editing is prepared.</span> : <span>Editing is paused until this Deck is verified.</span>}
    </div> : null}
    {retryEntry && !pending && error ? <button type="button" onClick={() => void open(retryEntry.id, retryEntry.card, retryEntry.fromUrl)}>Retry opening Deck</button> : null}
    {error && <p role="alert">{error}</p>}
    {!selected && progressReturn ? <div>
      <button type="button" disabled={pending !== null} onClick={() => void close()}>Back to Progress</button>
    </div> : null}
    {selected ? <>
      <DeckDetail key={`${currentUserId}:${selected.deckTemplateId}`} ready={verified} entryRevision={entryRevision} onAdopted={refreshWorking} deck={selectedLayout!}
        onArchive={() => membershipAction(selected.deckTemplateId, "archive")} archiveDisabled={pending !== null}
        backLabel={progressReturn ? "Back to Progress" : undefined}
        creatorEditHref={progressReturn ? `/creator/edit/${encodeURIComponent(selected.deckTemplateId)}?returnTo=deck&returnDeckId=${encodeURIComponent(selected.deckTemplateId)}&progressFramework=${encodeURIComponent(progressReturn.frameworkId)}${progressReturn.areaId ? `&progressArea=${encodeURIComponent(progressReturn.areaId)}` : ""}` : undefined}
        isDeckFlipped={Math.abs(rotation % 360) === 180} deckFlipRotationY={rotation} onBack={() => void close()} onToggleDeckFlip={(delta = 180) => setRotation((value) => value + delta)} transition={transition} />
    </> : <>
      <OverviewMenu username={userName} userId={currentUserId} /><header className="overview-header"><p className="eyebrow">{userName}</p><h1>My decks</h1></header>
      <DeckGrid decks={decks} instantiatingDeckTemplateId={pending} isInteractionLocked={pending !== null} onSelectDeck={(id) => void open(id)} transition={transition} />
      {active.filter((item) => item.availability === "unavailable").map((item) => <p key={item.deckTemplateId}>
        Unavailable Deck — your membership is retained. <button type="button" disabled={pending !== null} onClick={() => void membershipAction(item.deckTemplateId, "archive")}>Archive unavailable Deck</button>
      </p>)}
      {records.some((item) => item.archivedAt !== null) && <details><summary>Archived decks</summary>{records.filter((item) => item.archivedAt !== null).map((item) => <p key={item.deckTemplateId}>{item.title} <button type="button" disabled={pending !== null} onClick={() => void membershipAction(item.deckTemplateId, "restore")}>Restore {item.title}</button></p>)}</details>}
    </>}
  </main>;
}

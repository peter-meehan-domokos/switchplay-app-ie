"use client";
import { workingRequest } from "@/components/decks/updateClient";
import { personalWork } from "@/lib/cards/personalWork";
import Link from "next/link";
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
import { flushPersonalMutations } from "@/lib/deckMutations";
const transition = { type: "spring", stiffness: 300, damping: 30 };
export default function AppShell({ memberships, currentUserId, userName }: { memberships: MembershipDTO[]; currentUserId: string; userName: string }) {
  const [records, setRecords] = useState(memberships);
  const [selected, setSelected] = useState<Deck | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [rotation, setRotation] = useState(0);
  const selectedLayout = useMemo(() => selected ? buildDeckLayout(selected, { currentUserId, users: [{ id: currentUserId, name: userName }] }) : null, [selected, currentUserId, userName]);
  const actorRef = useRef(currentUserId);
  const refreshGeneration = useRef(0);
  const live = useRef(true);
  useEffect(() => {
    actorRef.current = currentUserId; live.current = true;
    return () => { live.current = false; };
  }, [currentUserId]);
  const [recordActor, setRecordActor] = useState(currentUserId);
  if (recordActor !== currentUserId) { setRecordActor(currentUserId); setRecords(memberships); setSelected(null); }
  const openedParam = useRef<string | null>(null);
  const active = records.filter((item) => item.archivedAt === null);
  const decks = buildMyDecksLayout(active.flatMap((item) => item.display ? [buildDeckLayout(item.display, { currentUserId, users: [{ id: currentUserId, name: userName }] })] : []));
  async function open(id: string, cardTemplateId?: string) {
    const membership = active.find((item) => item.deckTemplateId === id);
    if (!membership || pending) return;
    if (membership.availability === "unavailable") { setError("This Deck is currently unavailable. Your membership and personal state are retained."); return; }
    ++refreshGeneration.current;
    setPending(id); setError("");
    try {
      await flushPersonalMutations();
      const deck = await workingRequest<Deck>(currentUserId, "/api/decks-data", "POST", { deckTemplateId: id, localDate: getTodayDateOnly(), ...(cardTemplateId ? { cardTemplateId } : {}) });
      if (actorRef.current !== currentUserId || !live.current) return;
      workingCardStore.accept(currentUserId, buildDeckLayout(deck, { currentUserId, users: [] }).cards);
      openedParam.current = id; setSelected(deck); setRotation(0);
      window.history.replaceState(null, "", `/decks?openDeck=${encodeURIComponent(id)}`);
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to open Deck"); }
    finally { setPending(null); }
  }
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const id = query.get("openDeck");
    if (id && openedParam.current !== id) { openedParam.current = id; void open(id, query.get("openCard") ?? undefined); }
  });
  async function membershipAction(id: string, type: "archive" | "restore") {
    if (pending) return;
    ++refreshGeneration.current;
    setPending(id); setError("");
    try { await flushPersonalMutations(); await workingRequest(currentUserId, `/api/decks-data/${encodeURIComponent(id)}`, "PATCH", { type,
      ...(type === "restore" ? { membershipRevision: records.find((item) => item.deckTemplateId === id)?.membershipRevision } : {}) });
      setRecords(await workingRequest<MembershipDTO[]>(currentUserId, "/api/decks-data"));
      setSelected(null); window.history.replaceState(null, "", "/decks"); }
    catch (error) { setError(error instanceof Error ? error.message : "Membership update failed"); }
    finally { setPending(null); }
  }
  async function refreshWorking(command?: import("@/lib/cards/updateAdoption").UpdateCommand) {
    if (!selected) return;
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
    setSelected(deck); setRecords(membershipRecords);
  }
  useEffect(() => {
    let reading = false;
    const refresh = () => {
      if (!selected || reading || document.visibilityState === "hidden") return;
      reading = true;
      void refreshWorking().catch((error) => setError(error instanceof Error ? error.message : "Unable to refresh My Decks")).finally(() => { reading = false; }); };
    window.addEventListener("focus", refresh); window.addEventListener("pageshow", refresh); document.addEventListener("visibilitychange", refresh);
    return () => { window.removeEventListener("focus", refresh); window.removeEventListener("pageshow", refresh); document.removeEventListener("visibilitychange", refresh); };
  });
  async function close() {
    ++refreshGeneration.current;
    try { await flushPersonalMutations(); setRecords(await workingRequest<MembershipDTO[]>(currentUserId, "/api/decks-data")); setSelected(null); window.history.replaceState(null, "", "/decks"); }
    catch (error) { setError(error instanceof Error ? error.message : "Some changes could not be saved"); }
  }
  return <main className={`app-shell${selected ? " app-shell--deck" : ""}`}>
    {error && <p role="alert">{error}</p>}
    {selected ? <>
      <button type="button" disabled={pending !== null} onClick={() => void membershipAction(selected.deckTemplateId, "archive")}>Archive Deck</button>
      <DeckDetail key={`${currentUserId}:${selected.deckTemplateId}`} onAdopted={refreshWorking} deck={selectedLayout!} isDeckFlipped={Math.abs(rotation % 360) === 180} deckFlipRotationY={rotation} onBack={() => void close()} onToggleDeckFlip={(delta = 180) => setRotation((value) => value + delta)} transition={transition} />
    </> : <>
      <OverviewMenu username={userName} userId={currentUserId} /><header className="overview-header"><p className="eyebrow">{userName}</p><h1>My decks</h1><Link href="/creator/new">Create Deck</Link></header>
      <DeckGrid decks={decks} instantiatingDeckTemplateId={pending} isInteractionLocked={pending !== null} onSelectDeck={(id) => void open(id)} transition={transition} />
      {active.filter((item) => item.availability === "unavailable").map((item) => <p key={item.deckTemplateId}>
        Unavailable Deck — your membership is retained. <button type="button" disabled={pending !== null} onClick={() => void membershipAction(item.deckTemplateId, "archive")}>Archive unavailable Deck</button>
      </p>)}
      {records.some((item) => item.archivedAt !== null) && <details><summary>Archived decks</summary>{records.filter((item) => item.archivedAt !== null).map((item) => <p key={item.deckTemplateId}>{item.title} <button type="button" disabled={pending !== null} onClick={() => void membershipAction(item.deckTemplateId, "restore")}>Restore {item.title}</button></p>)}</details>}
    </>}
  </main>;
}

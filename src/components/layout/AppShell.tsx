"use client";
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
import { creatorRequest } from "@/components/creator/creatorRequest";
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
  const openedParam = useRef<string | null>(null);
  const active = records.filter((item) => item.archivedAt === null);
  const decks = buildMyDecksLayout(active.flatMap((item) => item.display ? [buildDeckLayout(item.display, { currentUserId, users: [{ id: currentUserId, name: userName }] })] : []));
  async function open(id: string) {
    const membership = active.find((item) => item.deckTemplateId === id);
    if (!membership || pending) return;
    setPending(id); setError("");
    try {
      await flushPersonalMutations();
      const deck = await creatorRequest<Deck>("/api/decks-data", "POST", { deckTemplateId: id, localDate: getTodayDateOnly() });
      workingCardStore.accept(currentUserId, buildDeckLayout(deck, { currentUserId, users: [] }).cards);
      openedParam.current = id; setSelected(deck); setRotation(0);
      window.history.replaceState(null, "", `/decks?openDeck=${encodeURIComponent(id)}`);
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to open Deck"); }
    finally { setPending(null); }
  }
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("openDeck");
    if (id && openedParam.current !== id) { openedParam.current = id; void open(id); }
  });
  async function membershipAction(id: string, type: "archive" | "restore") {
    if (pending) return;
    setPending(id); setError("");
    try { await flushPersonalMutations(); await creatorRequest(`/api/decks-data/${encodeURIComponent(id)}`, "PATCH", { type });
      setRecords(await creatorRequest<MembershipDTO[]>("/api/decks-data"));
      setSelected(null); window.history.replaceState(null, "", "/decks"); }
    catch (error) { setError(error instanceof Error ? error.message : "Membership update failed"); }
    finally { setPending(null); }
  }
  async function close() {
    try { await flushPersonalMutations(); setRecords(await creatorRequest<MembershipDTO[]>("/api/decks-data")); setSelected(null); window.history.replaceState(null, "", "/decks"); }
    catch (error) { setError(error instanceof Error ? error.message : "Some changes could not be saved"); }
  }
  return <main className={`app-shell${selected ? " app-shell--deck" : ""}`}>
    {error && <p role="alert">{error}</p>}
    {selected ? <>
      <button type="button" disabled={pending !== null} onClick={() => void membershipAction(selected.deckTemplateId, "archive")}>Archive Deck</button>
      <DeckDetail key={`${selected.deckTemplateId}:${selected.adoptedVersion}:${selected.openedAt}`} deck={selectedLayout!} isDeckFlipped={Math.abs(rotation % 360) === 180} deckFlipRotationY={rotation} onBack={() => void close()} onToggleDeckFlip={(delta = 180) => setRotation((value) => value + delta)} transition={transition} />
    </> : <>
      <OverviewMenu username={userName} userId={currentUserId} /><header className="overview-header"><p className="eyebrow">{userName}</p><h1>My decks</h1><Link href="/creator/new">Create Deck</Link></header>
      <DeckGrid decks={decks} instantiatingDeckTemplateId={pending} isInteractionLocked={pending !== null} onSelectDeck={(id) => void open(id)} transition={transition} />
      {records.some((item) => item.archivedAt !== null) && <details><summary>Archived decks</summary>{records.filter((item) => item.archivedAt !== null).map((item) => <p key={item.deckTemplateId}>{item.title} <button type="button" disabled={pending !== null} onClick={() => void membershipAction(item.deckTemplateId, "restore")}>Restore {item.title}</button></p>)}</details>}
    </>}
  </main>;
}

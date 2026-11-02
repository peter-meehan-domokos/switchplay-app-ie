"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { groupProgressHref, rememberGroupReturn, readGroupDeckReturn, readProgressReturn, progressReturnHref } from "@/lib/frameworks/progressNavigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import DeckScene from "@/components/decks/DeckScene";
import FocusedCardView from "@/components/decks/FocusedCardView";
import { createGroupResource, type GroupResourceState } from "./groupResource";
import { presentGroup } from "./groupPresentation";
import GroupCardBack from "./GroupCardBack";
import { isExperienceCard } from "@/components/decks/presentation";
import type { PerspectiveSelection } from "@/lib/groupExperiences/model";
import type { PersonalLearningChange } from "@/lib/cards/learning";
import "./group-experience.css";
import PerspectivePicker, { type PerspectiveChoice } from "./PerspectivePicker";
import PerspectiveGrid from "./PerspectiveGrid";
import DeckMenu from "@/components/decks/DeckMenu";
import GroupManagementForm from "./GroupManagementForm";
const emptyState: GroupResourceState = { verified: false, loading: true };
const noSubscribe = () => () => {};
const emptySnapshot = () => emptyState;

export default function GroupExperienceDeck({ actor, experienceId, onBack, onAccessRemoved }: { actor: string; experienceId: string; onBack(): void; onAccessRemoved?(): void }) {
  const router = useRouter(), entryQuery = useSearchParams();
  // Router search params describe the incoming route before window.location
  // commits during a soft navigation. Reading the latter loses return geometry.
  const [restored] = useState(() => readGroupDeckReturn(entryQuery, experienceId));
  const progressReturn = readProgressReturn(entryQuery);
  const [resource, setResource] = useState<ReturnType<typeof createGroupResource>>();
  const state = useSyncExternalStore(resource?.subscribe ?? noSubscribe, resource?.snapshot ?? emptySnapshot, resource?.snapshot ?? emptySnapshot);
  const [selection, setSelection] = useState<PerspectiveSelection | undefined>(restored?.selection);
  const [rotation, setRotation] = useState(restored?.rotation ?? 0);
  const [activeCardId, setActiveCardId] = useState<string | undefined>(restored?.cardId);
  const [focused, setFocused] = useState(restored?.focused ?? false);
  const [expanded, setExpanded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsPerspective = useRef<PerspectiveSelection | null>(null);
  useEffect(() => {
    // Effect lifetime owns transport resources, including Strict Mode's trial
    // mount. A disposed controller must never be reused by the next mount.
    const resource = createGroupResource(actor, experienceId);
    // Publish an externally owned controller; this must follow effect lifetime
    // so Strict Mode cleanup cannot leave a disposed resource mounted.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setResource(resource);
    void resource.load();
    const refresh = () => { if (document.visibilityState === "hidden") resource.invalidate(); else void resource.load(); };
    const hidden = () => { resource.invalidate(); if (document.visibilityState !== "hidden") void resource.load(); };
    const timer = window.setInterval(refresh, 4_000);
    window.addEventListener("focus", hidden); window.addEventListener("pageshow", hidden); document.addEventListener("visibilitychange", hidden);
    return () => { clearInterval(timer); window.removeEventListener("focus", hidden); window.removeEventListener("pageshow", hidden); document.removeEventListener("visibilitychange", hidden); resource.dispose(); };
  }, [actor, experienceId]);
  const data = "data" in state ? state.data : undefined;
  // Keep the form mounted even if authority polling observes a committed
  // self-removal before its HTTP acknowledgement reaches this browser.
  const settings = settingsOpen ? <GroupManagementForm key="management" actor={actor} experienceId={experienceId} onCancel={() => setSettingsOpen(false)}
    onSaved={async result => {
      if (!result.hasAccess) { resource?.dispose(); (onAccessRemoved ?? onBack)(); return; }
      resource?.invalidate(); await resource?.load();
      if (!resource?.snapshot().verified) throw Error("Saved; current access could not be refreshed.");
      // Structural revalidation temporarily purges peer rows. Restore only
      // after verification; the existing permission check rejects removed peers.
      if (settingsPerspective.current) setSelection(settingsPerspective.current);
      setSettingsOpen(false);
    }} /> : null;
  if (!data || !resource) return <main className="app-shell"><button type="button" onClick={onBack}>Back to My Decks</button>
    {"error" in state && state.error ? <p role="alert">{state.error} <button type="button" onClick={() => void resource?.load()}>Retry</button></p> : <p role="status">Loading experience…</p>}{settings}</main>;
  const boot = data.bootstrap;
  const chosen = selection ?? boot.selection;
  const permitted = chosen.perspective === "group" || chosen.perspective === "self" && boot.isFollower
    || chosen.perspective === "follower" && boot.canInspectFollowers && data.followers.some(row => row.userId === chosen.subjectUserId);
  const effective: PerspectiveSelection = permitted ? chosen : { perspective: boot.isAdmin ? "group" : "self" };
  if (selection && !permitted) setSelection(undefined);
  // A peer cache may still exist in memory, but never render it without a live
  // authority lease. Group/self fallback has no foreign-private data to reveal.
  const shown = effective.perspective === "follower" && !state.verified ? { perspective: boot.isAdmin ? "group" : "self" } as PerspectiveSelection : effective;
  const deck = presentGroup(data, shown, state.verified);
  // Adoption can remove a Card while this physical scene remains mounted.
  // Retained learning is not a historical navigation grant: use only a current
  // Card for both scene selection and subsequent preference writes.
  const currentCardId = [activeCardId, boot.activeCardId].find(id => deck.cards.some(card => card.id === id)) ?? deck.cards[0]?.id;
  if (!deck.cards.length && (focused || expanded)) { setFocused(false); setExpanded(false); }
  const choices: PerspectiveChoice[] = [{ key: "group", name: boot.name, group: true, selection: { perspective: "group" } },
    ...data.followers.map(row => ({ key: row.userId, name: row.username, selection: row.userId === actor ? { perspective: "self" as const } : { perspective: "follower" as const, subjectUserId: row.userId } }))];
  const selectedKey = shown.perspective === "group" ? "group" : shown.perspective === "self" ? actor : shown.subjectUserId;
  const comparisonOpen = expanded && focused && boot.canInspectFollowers && state.verified;
  const select = (choice: PerspectiveChoice) => { setSelection(choice.selection); void resource.navigate(choice.selection, currentCardId).catch(() => resource.invalidate()); };
  const save = (cardId: string, change: PersonalLearningChange) => {
    const card = deck.cards.find(card => card.id === cardId);
    if (card?.canWriteLearning) void resource.save(cardId, shown.perspective === "group" ? "group" : "personal", card.version, boot.accessEpoch, change);
  };
  const cycle = (cardId: string, stepId: string) => {
    const card = deck.cards.find(card => card.id === cardId)!, states = ["todo", "inProgress", "done", "skipped"] as const;
    const old = card.learning.items.find(item => item.stepId === stepId)!.completionStatus;
    save(cardId, { kind: "completion", stepId, completionStatus: states[(states.indexOf(old) + 1) % states.length] });
  };
  return <main className="app-shell app-shell--deck group-experience" data-experience-id={experienceId} data-perspective-key={selectedKey}
    data-current-card={currentCardId} data-face={Math.abs(rotation % 360) === 180 ? "back" : "front"}>
    {!state.verified ? <p className="group-verification" role="status">Verifying current access… <button type="button" onClick={() => void resource.load()}>Retry</button></p> : null}
    <DeckScene deck={deck} initialCardTemplateId={currentCardId} initiallyFocused={!!restored?.focused}
      deckActions={<DeckMenu deckId={experienceId} deckTemplateId={boot.deckTemplateId} showEdit={false}
        progressAction={{ disabled: !state.verified, onSelect: () => {
          try { rememberGroupReturn(sessionStorage, actor, { experienceId, cardId: currentCardId, rotation, focused, selection: shown, returnToProgress: progressReturn ?? undefined }); } catch { /* Optional storage. */ }
          router.push(groupProgressHref(experienceId));
        } }}
        groupAction={boot.isAdmin ? { label: "Group settings", disabled: !state.verified, onSelect: () => {
          // Pin the displayed perspective before changing roles. A role-default
          // change after self-demotion must not replace a still-valid selection.
          settingsPerspective.current = shown; setSelection(shown); setSettingsOpen(true);
        } } : undefined} />}
      onFocusChange={value => { setFocused(value); if (!value) setExpanded(false); }}
      playbackViewerUserId={actor} isDeckFlipped={Math.abs(rotation % 360) === 180} deckFlipRotationY={rotation}
      onToggleDeckFlip={(delta = 180) => setRotation(value => value + delta)} onBack={progressReturn ? () => router.push(progressReturnHref(progressReturn), { scroll: false }) : onBack} backLabel={progressReturn ? "Back to Progress" : "Back to My Decks"}
      transition={{ type: "spring", stiffness: 300, damping: 30 }} error={state.error ?? state.mutationError}
      onActiveCardChange={(_previous, next) => { const card = deck.cards[next]; if (card) { setActiveCardId(card.id); void resource.navigate(shown, card.id).catch(() => resource.invalidate()); } }}
      renderCardBackFace={(card, options) => isExperienceCard(card) ? <GroupCardBack card={card} focused={options.variant !== "preview"} /> : null}
      renderFocusedCard={props => isExperienceCard(props.card) ? <FocusedCardView {...props} interactionLocked={!state.verified}
        comparisonFraction={comparisonOpen ? .38 : 0}
        onFaceChange={setRotation}
        onCycleStepStatus={props.card.canWriteLearning ? stepId => cycle(props.card.id, stepId) : undefined}
        backFace={<GroupCardBack card={props.card} focused onChange={change => save(props.card.id, change)} />} /> : null} />
    {comparisonOpen ? <PerspectiveGrid choices={choices} selected={selectedKey} groupName={boot.name} onSelect={select} onCollapse={() => {
      setExpanded(false); requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(".group-picker-current")?.focus());
    }} />
      : <PerspectivePicker choices={choices} selected={selectedKey} ownKey={boot.isFollower ? actor : undefined} canCompare={boot.canInspectFollowers}
        focused={focused} disabled={!state.verified} onSelect={select} onCompare={setExpanded} />}
    {settings}
  </main>;
}

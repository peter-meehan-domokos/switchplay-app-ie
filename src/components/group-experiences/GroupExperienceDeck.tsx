"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { hasInitialGroupPreparation } from "@/lib/cards/preparationClient";
import { acceptGroupLoginDefault, needsGroupLoginDefault } from "@/lib/groupExperiences/loginPerspective";
import { groupProgressHref, rememberGroupReturn, readGroupDeckReturn, readProgressReturn, progressReturnHref } from "@/lib/frameworks/progressNavigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import CardMediaCentre from "@/components/media/CardMediaCentre";
import CollectionGallery from "@/components/media/CollectionGallery";
import type { MediaCollectionContext, MediaCollectionPage } from "@/lib/mediaCollection/contracts";
import { viewerIdentity } from "@/lib/groupExperiences/media/contributionIdentity";
import type { OpenCardMedia } from "@/lib/cardMediaViewer";
import DeckScene from "@/components/decks/DeckScene";
import FocusedCardView from "@/components/decks/FocusedCardView";
import { retainedGroupResource, type GroupResourceState } from "./groupResource";
import { presentGroup } from "./groupPresentation";
import GroupCardBack from "./GroupCardBack";
import type { ReflectionAreaContext } from "@/components/reflections/ReflectionArea";
import { isExperienceCard } from "@/components/decks/presentation";
import type { PerspectiveSelection } from "@/lib/groupExperiences/model";
import type { PersonalLearningChange } from "@/lib/cards/learning";
import "./group-experience.css";
import PerspectivePicker, { type PerspectiveChoice } from "./PerspectivePicker";
import PerspectiveGrid from "./PerspectiveGrid";
import DeckMenu from "@/components/decks/DeckMenu";
import GroupManagementForm from "./GroupManagementForm";
import GroupUpdateControls from "./GroupUpdateControls";
import { useGroupPreparation } from "./useGroupPreparation";
const emptyState: GroupResourceState = { verified: false, loading: true };
const noSubscribe = () => () => {};
const emptySnapshot = () => emptyState;

export default function GroupExperienceDeck({ actor, experienceId, onBack, onAccessRemoved }: { actor: string; experienceId: string; onBack(): void; onAccessRemoved?(): void }) {
  const router = useRouter(), entryQuery = useSearchParams();
  // Router search params describe the incoming route before window.location
  // commits during a soft navigation. Reading the latter loses return geometry.
  const [loginDefault] = useState(() => typeof window !== "undefined" && needsGroupLoginDefault(actor, experienceId));
  const [restored] = useState(() => loginDefault ? undefined : readGroupDeckReturn(entryQuery, experienceId));
  const progressReturn = readProgressReturn(entryQuery);
  const resource = useMemo(() => typeof window === "undefined" ? undefined : retainedGroupResource(actor, experienceId), [actor, experienceId]);
  const state = useSyncExternalStore(resource?.subscribe ?? noSubscribe, resource?.snapshot ?? emptySnapshot, emptySnapshot);
  const [selection, setSelection] = useState<PerspectiveSelection | undefined>(restored?.selection);
  const [initialPresented, setInitialPresented] = useState(false);
  const [reflectionOpen, setReflectionOpen] = useState(false);
  const [rotation, setRotation] = useState(restored?.rotation ?? 0);
  const [activeCardId, setActiveCardId] = useState<string | undefined>(restored?.cardId);
  const [focused, setFocused] = useState(restored?.focused ?? false);
  const [expanded, setExpanded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const root = useRef<HTMLElement | null>(null);
  const [sceneBusy, setSceneBusy] = useState(false), [focusBusy, setFocusBusy] = useState(false);
  const [pendingChoice, setPendingChoice] = useState<PerspectiveChoice>();
  const [preparationError, setPreparationError] = useState<string>();
  const selectionIntent = useRef(0);
  const retryChoice = useRef<PerspectiveChoice | undefined>(undefined);
  const [mediaOverlay, setMediaOverlay] = useState<{ kind: "gallery" | "centre"; cardId: string; selectedKey?: string; initialPage?: MediaCollectionPage; authority: string; focused: boolean; context: MediaCollectionContext; version: number } | null>(null);
  const mediaSourceRef = useRef<HTMLButtonElement | null>(null);
  const settingsPerspective = useRef<PerspectiveSelection | null>(null);
  useGroupPreparation(resource, root, actor, experienceId, settingsOpen || reflectionOpen || !!mediaOverlay || sceneBusy || focused && focusBusy || !!pendingChoice || expanded);
  useEffect(() => () => { selectionIntent.current++; resource?.releasePerspectiveIntent(); resource?.setFollowerIntent(false); }, [resource]);
  useEffect(() => {
    // View lifetime owns timers, not accepted data or submitted work.
    if (!resource) return;
    const unwatch = resource.watch();
    void resource.prepare(loginDefault ? { perspective: "default" } : restored?.selection, restored?.cardId);
    return unwatch;
  }, [resource, restored?.selection, restored?.cardId, loginDefault]);
  const data = state.data?.bootstrap.viewerUserId === actor && state.data.bootstrap.experienceId === experienceId ? state.data : undefined;
  const initialSelection = restored?.selection ?? data?.bootstrap.selection;
  const initialAllowed = data && initialSelection && (initialSelection.perspective === "group" || initialSelection.perspective === "self" && data.bootstrap.isFollower
    || initialSelection.perspective === "follower" && data.bootstrap.canInspectFollowers && data.followers.some(row => row.userId === initialSelection.subjectUserId));
  const initialComplete = !!data && hasInitialGroupPreparation(actor, data.bootstrap, initialAllowed ? initialSelection! : data.bootstrap.selection);
  useEffect(() => {
    if (!loginDefault || !initialComplete) return;
    acceptGroupLoginDefault(actor, experienceId);
    // A pre-login return URL must not revive its old perspective on reload.
    const url = new URL(window.location.href);
    if (url.searchParams.get("openExperience") === experienceId && url.searchParams.has("progressScene")) {
      for (const key of ["progressScene", "progressFace", "progressFocused", "progressPerspective", "progressSubject"]) url.searchParams.delete(key);
      window.history.replaceState(null, "", url.pathname + url.search);
    }
  }, [loginDefault, initialComplete, actor, experienceId]);
  if (initialComplete && !initialPresented) setInitialPresented(true);
  // Keep the form mounted even if authority polling observes a committed
  // self-removal before its HTTP acknowledgement reaches this browser.
  const settings = settingsOpen ? <GroupManagementForm key="management" actor={actor} experienceId={experienceId} onCancel={() => setSettingsOpen(false)}
    onSaved={async result => {
      if (!result.hasAccess) { resource?.dispose(); (onAccessRemoved ?? onBack)(); return; }
      if (!await resource?.revalidate(result.structureRevision)) throw Error("Saved; current access could not be refreshed.");
      // Structural revalidation temporarily purges peer rows. Restore only
      // after verification; the existing permission check rejects removed peers.
      if (settingsPerspective.current) setSelection(settingsPerspective.current);
      setSettingsOpen(false);
    }} /> : null;
  if (!data || !resource || !initialPresented && !initialComplete) return <main className="app-shell"><button type="button" onClick={onBack}>Back to My Decks</button>
    {"error" in state && state.error ? <p role="alert">{state.error} <button type="button" onClick={() => void (initialPresented ? resource?.resume() : resource?.prepare(loginDefault ? { perspective: "default" } : restored?.selection, restored?.cardId))}>Retry</button></p> : <p role="status">Loading experience…</p>}{settings}</main>;
  const boot = data.bootstrap;
  const chosen = selection ?? boot.selection;
  const permitted = chosen.perspective === "group" || chosen.perspective === "self" && boot.isFollower
    || chosen.perspective === "follower" && boot.canInspectFollowers && data.followers.some(row => row.userId === chosen.subjectUserId);
  const storedSelection = boot.selection;
  const restoredAllowed = storedSelection.perspective === "group" || storedSelection.perspective === "self" && boot.isFollower
    || storedSelection.perspective === "follower" && boot.canInspectFollowers && data.followers.some(row => row.userId === storedSelection.subjectUserId);
  const effective: PerspectiveSelection = permitted ? chosen : restoredAllowed ? boot.selection : { perspective: boot.isAdmin ? "group" : "self" };
  if (selection && !permitted) setSelection(undefined);
  // A stale lease disables writes. Confirmed denial/composition changes purge
  // affected resources; routine verification must not reconstruct the Card.
  const shown = effective;
  const deck = presentGroup(data, shown, state.verified);
  // Adoption can remove a Card while this physical scene remains mounted.
  // Retained learning is not a historical navigation grant: use only a current
  // Card for both scene selection and subsequent preference writes.
  const currentCardId = [activeCardId, boot.activeCardId].find(id => deck.cards.some(card => card.id === id)) ?? deck.cards[0]?.id;
  if (!deck.cards.length && (focused || expanded)) { setFocused(false); setExpanded(false); }
  const choices: PerspectiveChoice[] = [{ key: "group", name: boot.name, group: true, selection: { perspective: "group" } },
    ...data.followers.map(row => ({ key: row.userId, name: row.username, selection: row.userId === actor ? { perspective: "self" as const } : { perspective: "follower" as const, subjectUserId: row.userId } }))];
  const selectedKey = shown.perspective === "group" ? "group" : shown.perspective === "self" ? actor : shown.subjectUserId;
  const mediaAuthority = JSON.stringify([actor, experienceId, effective, boot.accessEpoch, boot.adoptionRevision, boot.structureRevision, boot.isAdmin, boot.isFollower]);
  // Own history remains authorised by its creator identity while Group writes
  // revalidate. Never retain or substitute a foreign perspective's media.
  const mediaContext = (cardId: string): MediaCollectionContext | null => shown.perspective === "self" && effective.perspective === "self"
    ? { kind: "owner", viewerUserId: actor, cardTemplateId: cardId, experienceId }
    : { kind: "group", viewerUserId: actor, cardTemplateId: cardId, experienceId, accessEpoch: boot.accessEpoch, adoptionRevision: boot.adoptionRevision, structureRevision: boot.structureRevision,
      ...(shown.perspective === "follower" ? { subjectUserId: shown.subjectUserId } : {}) };
  const reflectionContext = (cardId: string): ReflectionAreaContext => ({
    viewerUserId: actor, cardTemplateId: cardId, adoptionRevision: boot.adoptionRevision, structureRevision: boot.structureRevision,
    view: { kind: "group", experienceId, mode: shown.perspective === "self" ? "own" : shown.perspective === "group" ? "group" : "inspection",
      subjectUserId: shown.perspective === "follower" ? shown.subjectUserId : undefined, accessEpoch: boot.accessEpoch },
  });
  const signalReadOnlyReason = !state.verified ? "Checking your access. Try again in a moment."
    : shown.perspective === "group" ? "Only a Group Admin can change this value." : "Only this member can change this value.";
  const validOverlay = mediaOverlay?.authority === mediaAuthority && mediaOverlay.cardId === currentCardId && mediaOverlay.focused === focused ? mediaOverlay : null;
  if (mediaOverlay && !validOverlay) setMediaOverlay(null);
  const openMedia: OpenCardMedia = (cardId, selectedKey, source, scene, initialPage) => {
    if (!scene || !state.verified || mediaOverlay || settingsOpen) return;
    mediaSourceRef.current = source;
    setMediaOverlay({ kind: "gallery", cardId, selectedKey, initialPage, authority: mediaAuthority, focused: scene.focused, context: mediaContext(cardId)!, version: deck.cards.find(c => c.id === cardId)!.version });
  };
  const openCentre = (cardId: string) => {
    if (!focused || !state.verified || mediaOverlay || settingsOpen) return;
    mediaSourceRef.current = document.activeElement as HTMLButtonElement;
    setMediaOverlay({ kind: "centre", cardId, authority: mediaAuthority, focused, context: mediaContext(cardId)!, version: deck.cards.find(c => c.id === cardId)!.version });
  };
  const comparisonOpen = expanded && focused && boot.canInspectFollowers;
  const select = (choice: PerspectiveChoice) => {
    const intent = ++selectionIntent.current;
    retryChoice.current = choice;
    resource.releasePerspectiveIntent(); setPreparationError(undefined);
    const apply = () => { setSelection(choice.selection); setPendingChoice(undefined); void resource.navigate(choice.selection, currentCardId).catch(() => resource.invalidate()); };
    if (resource.isPrepared(choice.selection)) { apply(); return; }
    setPendingChoice(choice);
    void resource.preparePerspective(choice.selection).then(ready => {
      if (intent !== selectionIntent.current) return;
      if (ready) apply();
      else { setPendingChoice(undefined); setPreparationError(resource.snapshot().preparation?.error ?? "This perspective could not be prepared. Retry."); }
    });
  };
  const followers = { ready: resource.followersReady(), error: state.preparation?.followers === "error" ? state.preparation.error : undefined,
    retry: () => { resource.setFollowerIntent(true); void resource.prepareFollowers(); } };
  const compare = (value: boolean) => { setExpanded(value); resource.setFollowerIntent(value); if (value) void resource.prepareFollowers(); };
  const save = (cardId: string, change: PersonalLearningChange) => {
    const card = deck.cards.find(card => card.id === cardId);
    if (card?.canWriteLearning) void resource.save(cardId, shown.perspective === "group" ? "group" : "personal", card.version, boot.accessEpoch, change);
  };
  const cycle = (cardId: string, stepId: string) => {
    const card = deck.cards.find(card => card.id === cardId)!, states = ["todo", "inProgress", "done", "skipped"] as const;
    const old = card.learning.items.find(item => item.stepId === stepId)!.completionStatus;
    save(cardId, { kind: "completion", stepId, completionStatus: states[(states.indexOf(old) + 1) % states.length] });
  };
  return <main ref={root} className="app-shell app-shell--deck group-experience" data-experience-id={experienceId} data-perspective-key={selectedKey}
    data-current-card={currentCardId} data-face={Math.abs(rotation % 360) === 180 ? "back" : "front"}>
    {!state.verified ? <p className="group-verification" role="status">Verifying current access… <button type="button" onClick={() => void resource.resume()}>Retry</button></p> : null}
    <GroupUpdateControls key={`${actor}:${experienceId}`} actor={actor} experienceId={experienceId} deck={deck}
      enabled={state.verified && boot.isAdmin && effective.perspective === "group"} onAdopted={async command => {
        if (!await resource.revalidate(command.expectedStructureRevision + 1)) throw Error("Update saved; current Group could not be refreshed.");
      }}>{updates => <DeckScene deck={deck} updateAction={updates.deckButton} cardFrontAction={card => updates.cardButton(card.id)} initialCardTemplateId={currentCardId} initiallyFocused={!!restored?.focused}
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
      onFocusChange={value => { setFocused(value); if (!value) compare(false); }} onPreparationBusyChange={setSceneBusy}
      playbackViewerUserId={actor} isDeckFlipped={Math.abs(rotation % 360) === 180} deckFlipRotationY={rotation}
      onToggleDeckFlip={(delta = 180) => setRotation(value => value + delta)} onBack={progressReturn ? () => router.push(progressReturnHref(progressReturn), { scroll: false }) : onBack} backLabel={progressReturn ? "Back to Progress" : "Back to My Decks"}
      transition={{ type: "spring", stiffness: 300, damping: 30 }} error={state.error ?? state.mutationError ?? updates.error}
      onActiveCardChange={(_previous, next) => { const card = deck.cards[next]; if (card) { setActiveCardId(card.id); void resource.navigate(shown, card.id).catch(() => resource.invalidate()); } }}
      onOpenMedia={openMedia} mediaViewerOpen={!!validOverlay}
      renderMediaOverlay={scene => {
        const context = validOverlay?.context, card = deck.cards.find(c => c.id === validOverlay?.cardId);
        if (!context || !validOverlay || !card || !isExperienceCard(card) || scene.transitioning || scene.activeCardId !== card.id) return null;
        return validOverlay.kind === "gallery" ? <CollectionGallery refreshOwner={resource} key={`${mediaAuthority}:${card.id}`} context={context} selectedKey={validOverlay.selectedKey!} initialPage={validOverlay.initialPage} sourceRef={mediaSourceRef} backgroundRef={scene.backgroundRef} onClose={() => setMediaOverlay(null)} />
          : <CardMediaCentre refreshOwner={resource} key={`${mediaAuthority}:${card.id}`} context={context} readOnly={!state.verified}
            groupUpload={{ viewerUserId: actor, experienceId, cardTemplateId: card.id, accessEpoch: boot.accessEpoch, version: card.version, creationContext: viewerIdentity(context) }}
            sourceRef={mediaSourceRef} backgroundRef={scene.backgroundRef} onClose={() => setMediaOverlay(null)} />;
      }}
      renderCardBackFace={(card, options) => isExperienceCard(card) ? <GroupCardBack refreshOwner={resource} reflectionInteractive={state.verified} reflectionContext={!focused && card.id === currentCardId ? reflectionContext(card.id) : null} readOnlyReason={signalReadOnlyReason} card={card} focused={false} mediaContext={mediaContext(card.id)} onOpenMedia={options.onOpenMedia} onEditMedia={!focused && options.variant !== "preview" ? openCentre : undefined} /> : null}
      renderFocusedCard={props => isExperienceCard(props.card) ? <FocusedCardView {...props} playbackViewerUserId={actor} onPreparationBusyChange={setFocusBusy} frontAction={updates.cardButton(props.card.id)} interactionLocked={!!validOverlay || reflectionOpen || updates.open}
        comparisonFraction={comparisonOpen ? .38 : 0}
        onFaceChange={setRotation}
        onCycleStepStatus={props.card.canWriteLearning ? stepId => cycle(props.card.id, stepId) : undefined}
        backFace={<GroupCardBack refreshOwner={resource} reflectionInteractive={state.verified} reflectionContext={reflectionContext(props.card.id)} onReflectionModalChange={setReflectionOpen} readOnlyReason={signalReadOnlyReason} card={props.card} focused mediaContext={mediaContext(props.card.id)} onEditMedia={openCentre} onChange={change => save(props.card.id, change)} />} /> : null} />}</GroupUpdateControls>
    {comparisonOpen ? <PerspectiveGrid choices={choices} selected={selectedKey} groupName={boot.name} onSelect={select} followers={followers} onCollapse={() => {
      compare(false); requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(".group-picker-current")?.focus());
    }} />
      : <PerspectivePicker choices={choices} selected={selectedKey} ownKey={boot.isFollower ? actor : undefined} canCompare={boot.canInspectFollowers}
        focused={focused} disabled={false} onSelect={select} onCompare={compare} followers={followers} pendingKey={pendingChoice?.key}
        preparationError={preparationError} onRetry={() => { if (retryChoice.current) select(retryChoice.current); }} />}
    {settings}
  </main>;
}

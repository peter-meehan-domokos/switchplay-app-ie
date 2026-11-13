"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { InfoCardFaceContent } from "./InfoCardFace";
import type { InfoMedia, MediaContext, PersonalInfoSource, PersonalInfoContext, PersonalInfoAssociation } from "@/lib/infoCards/model";
import InfoCardPouch from "./InfoCardPouch";
import InfoCardPhysicalStack from "./InfoCardPhysicalStack";
import InfoCardEmptyPanel from "./InfoCardEmptyPanel";
import InfoCardMediaViewer, { type InfoCardMedia } from "./InfoCardMediaViewer";
import InfoCardRemoteMediaViewer from "./InfoCardRemoteMediaViewer";
import { containInfoCardFocus, isolateInfoCardEvent, useInfoCardDialog } from "./useInfoCardDialog";
import styles from "./InfoCardConsultation.module.css";
import stepStyles from "@/components/decks/StepView.module.css";
import PersonalInfoEditorDialog from "./PersonalInfoEditorDialog";
import type { InfoEditorDTO } from "./infoCardEditorController";
import { actorCreatorTransport, creatorRequest, CreatorActorLifetime } from "../creator/creatorRequest";
import { workingCardStore } from "@/lib/cards/workingCardStore";
import { infoCardError } from "./infoCardErrors";
import { clientId } from "@/lib/clientId";

// Presentation input, not an authorisation or persistence model. Phase 4 supplies
// an authorised publication snapshot. Phase 1 supplies temporary fixture data.
export type AvailableConsultationCard = Omit<InfoCardFaceContent, "mediaKind"> & {
  id: string;
  unavailable?: false;
  personalSource?: PersonalInfoSource;
} & ({ publication: MediaContext; media?: InfoMedia } | { publication?: undefined; media?: InfoCardMedia });
export type InfoCardConsultationCard = AvailableConsultationCard | { id: string; unavailable: true };

function measure(anchor: HTMLElement) {
  const rect = anchor.getBoundingClientRect(), css = getComputedStyle(anchor);
  const width = parseFloat(css.width), height = parseFloat(css.height);
  return { left: rect.left, top: rect.top, width, height, scale: rect.width / width, borderRadius: css.borderRadius };
}

export default function InfoCardConsultation({ id, cards, anchor, source, onClose, status = "ready", loadingMessage = false, count = cards.length, actor,
  personalContext, personalSources, selectedId, onSelect, onRefresh, onReplace, recoveryId }: {
  id: string;
  cards: readonly InfoCardConsultationCard[];
  anchor: HTMLElement;
  source: HTMLElement;
  onClose: () => void;
  status?: "pending" | "ready" | "failed";
  loadingMessage?: boolean;
  count?: number;
  actor?: string;
  personalContext?: PersonalInfoContext & { mainCardId: string };
  personalSources?: PersonalInfoSource[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  onRefresh?: (selectedId?: string, successors?: readonly string[]) => Promise<InfoCardConsultationCard[]>;
  onReplace?: (cards: InfoCardConsultationCard[], selectedId?: string) => void;
  recoveryId?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const [geometry, setGeometry] = useState(() => measure(anchor));
  const [pouchGeometry, setPouchGeometry] = useState(() => measure(anchor));
  const [media, setMedia] = useState<AvailableConsultationCard | null>(null);
  const [mediaSource, setMediaSource] = useState<HTMLElement | undefined>(undefined);
  const openMedia = (card: AvailableConsultationCard) => {
    // Capture before the stack becomes inert for the nested modal.
    setMediaSource(document.activeElement instanceof HTMLElement ? document.activeElement : undefined);
    setMedia(card);
  };
  const [closing, setClosing] = useState(false);
  const [authoring, setAuthoring] = useState<{ id: string; initial: InfoEditorDTO | null; username: string; origin: string; source?: HTMLElement } | null>(null);
  const [mutation, setMutation] = useState(false), [error, setError] = useState("");
  const live = useRef(true), operation = useRef(0), recovering = useRef(false);
  const [lifetime] = useState(() => new CreatorActorLifetime());
  useLayoutEffect(() => { live.current = true; lifetime.setActive(true); return () => { live.current = false; lifetime.setActive(false); }; }, [lifetime]);
  const [request] = useState(() => actorCreatorTransport(actor ?? "", () => lifetime.isActive()));
  useEffect(() => {
    if (!actor) return;
    let active = true;
    const check = () => { void creatorRequest<{ user: { id: string } | null }>("/api/auth/me").then(result => {
      if (active && result.user?.id !== actor) { workingCardStore.clearUser(actor); onClose(); }
    }).catch(() => {}); };
    window.addEventListener("focus", check); window.addEventListener("pageshow", check);
    return () => { active = false; window.removeEventListener("focus", check); window.removeEventListener("pageshow", check); };
  }, [actor, onClose]);
  function acceptAssociation(association?: PersonalInfoAssociation) {
    if (!actor || !association) return;
    workingCardStore.acceptPersonal(actor, association); workingCardStore.invalidate(actor);
  }
  async function edit(card?: AvailableConsultationCard, draftId?: string) {
    if (!personalContext || !actor || mutation || authoring || closing || cards.length > 0 && motionBusy.current && !draftId) return;
    const token = ++operation.current;
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    // Menu items disappear on selection. Restore to their persistent trigger,
    // not to the removed item when the embedded editor closes.
    const returnTo = active?.closest("[data-info-card-menu]")?.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]') ?? active;
    setMutation(true); setError("");
    try {
      const auth = await request<{ user: { id: string; username: string } | null }>("/api/auth/me");
      if (auth.user?.id !== actor) throw new Error("Your account changed. Reload before continuing.");
      const target = draftId ?? card?.id;
      const initial = target ? await request<InfoEditorDTO>(`/api/info-cards/${encodeURIComponent(target)}`) : null;
      if (initial && (initial.root.kind !== "personal" || initial.root.ownerUserId !== actor
        || initial.root.originCardTemplateId !== personalContext.mainCardId && !personalSources?.some(source => source.cardTemplateId === initial.root.originCardTemplateId))) throw new Error("Info Card unavailable.");
      if (token !== operation.current || !live.current) return;
      setAuthoring({ id: target ?? clientId(), initial, username: auth.user.username,
        origin: initial?.root.originCardTemplateId ?? personalContext.mainCardId, source: returnTo });
      if (draftId) { const url = new URL(window.location.href); url.searchParams.delete("personalDraft"); window.history.replaceState(null, "", url.pathname + url.search); }
    } catch (cause) { if (live.current && token === operation.current) setError(infoCardError(cause)); }
    finally { if (live.current && token === operation.current) setMutation(false); }
  }
  async function remove(card: AvailableConsultationCard) {
    if (!card.personalSource || !actor || mutation || authoring || motionBusy.current) return;
    const token = ++operation.current; setMutation(true); setError("");
    try {
      const association = await request<PersonalInfoAssociation>(`/api/cards-data/${encodeURIComponent(card.personalSource.cardTemplateId)}/personal-info-cards`, "PATCH",
        { infoCardId: card.id, revision: card.personalSource.personalInfoRevision });
      if (!live.current || token !== operation.current) return;
      acceptAssociation(association);
      const remaining = cards.filter(item => item.id !== card.id), oldIndex = cards.findIndex(item => item.id === card.id);
      const successors = cards.slice(oldIndex + 1).concat(cards.slice(0, oldIndex)).map(item => item.id);
      const successor = successors.find(id => remaining.some(next => next.id === id));
      onReplace?.(remaining, successor);
      await onRefresh?.(successor, successors);
    } catch (cause) { if (live.current && token === operation.current) setError(infoCardError(cause)); }
    finally { if (live.current && token === operation.current) setMutation(false); }
  }
  const [position, setPosition] = useState(1);
  const motionBusy = useRef(true);
  // The empty panel only appears when the user can add a Personal Info Card; otherwise there is no surface to animate.
  const hasSurface = status === "ready" && (cards.length > 0 || !!personalContext);
  // True once the pack has been shown: an empty panel that replaces it (last Remove) does not fly in again.
  const [hadCards, setHadCards] = useState(false);
  if (!hadCards && status === "ready" && cards.length > 0) setHadCards(true);
  // After the first Save the new card opens through the stack's normal animation; focus follows when it settles.
  const focusAfterOpening = useRef(false);
  const onBusyChange = useCallback((busy: boolean) => {
    motionBusy.current = busy;
    if (!busy && focusAfterOpening.current) {
      focusAfterOpening.current = false;
      requestAnimationFrame(() => requestAnimationFrame(() => dialog.current?.querySelector<HTMLButtonElement>('[data-info-card-current="true"] [aria-label="Info Card actions"]')?.focus({ preventScroll: true })));
    }
  }, []);
  const requestClose = () => { if (!media && !authoring && !mutation) { if (hasSurface) setClosing(true); else onClose(); } };
  useInfoCardDialog(dialog, closeButton, source, true);
  useLayoutEffect(() => {
    (status === "ready" ? closeButton.current : dialog.current?.querySelector<HTMLElement>("[data-info-card-pouch]"))?.focus({ preventScroll: true });
  }, [status]);
  useLayoutEffect(() => {
    if (!cards.length && status === "ready") onBusyChange(false);
  }, [cards.length, status, onBusyChange]);
  useLayoutEffect(() => {
    if (!recoveryId || recovering.current || status !== "ready" || !personalContext) return;
    recovering.current = true;
    queueMicrotask(() => { if (live.current) void edit(undefined, recoveryId); });
    // Recovery is an explicit one-shot route entry, not a background refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recoveryId, status, personalContext]);
  useLayoutEffect(() => {
    let frame = 0;
    const update = () => {
      const next = measure(anchor);
      setPouchGeometry(previous => Object.keys(next).every(key => previous[key as keyof typeof next] === next[key as keyof typeof next]) ? previous : next);
      // Freeze rendered dimensions during each movement. Apply any viewport
      // change once settled, rather than scaling a pack in flight.
      if (status !== "ready" || !motionBusy.current) setGeometry(previous => Object.keys(next).every(key => previous[key as keyof typeof next] === next[key as keyof typeof next]) ? previous : next);
      frame = requestAnimationFrame(update);
    };
    update();
    return () => cancelAnimationFrame(frame);
  }, [anchor, status]);

  const bottom = pouchGeometry.top + pouchGeometry.height * pouchGeometry.scale;
  const below = bottom + 36 < (window.visualViewport?.height ?? window.innerHeight);
  const statusStyle = below ? { left: pouchGeometry.left, top: bottom + 8, maxWidth: pouchGeometry.width * pouchGeometry.scale }
    : { left: 8, top: bottom - 36, maxWidth: Math.max(0, pouchGeometry.left - 16) };

  return createPortal(<>
    <dialog ref={dialog} tabIndex={-1} className={styles.dialog} aria-label="Info card consultation" aria-modal="true"
      onClick={isolateInfoCardEvent} onPointerDown={isolateInfoCardEvent} onPointerMove={isolateInfoCardEvent}
      onPointerUp={isolateInfoCardEvent} onPointerCancel={isolateInfoCardEvent} onWheel={isolateInfoCardEvent}
      onKeyDown={event => {
        containInfoCardFocus(event);
        if (event.key === "Escape") { event.preventDefault(); requestClose(); }
      }} onKeyUp={isolateInfoCardEvent}
      onCancel={event => { event.preventDefault(); requestClose(); }}>
      <button className={styles.dismissSurface} tabIndex={-1} type="button" aria-label="Close information cards and return to step" onClick={requestClose} />
      {status === "ready" && <div className={styles.alignment} style={{ left: geometry.left, top: geometry.top, width: geometry.width,
        height: geometry.height, borderRadius: geometry.borderRadius, transform: `scale(${geometry.scale})` }}>
        {cards.length ? <InfoCardPhysicalStack id={id} cards={cards} selectedId={selectedId} onSelect={onSelect} closing={closing}
          blocked={Boolean(media || authoring || mutation)} closeRef={closeButton} pouch={source} pouchGeometry={pouchGeometry}
          actions={personalContext ? card => ({ onNew: () => void edit(), ...(card && !card.unavailable && card.personal && card.personalSource ? {
            onEdit: () => void edit(card), onRemove: () => void remove(card) } : {}) }) : undefined}
          onRequestClose={requestClose} onExited={onClose} onBusyChange={onBusyChange} onOpenMedia={openMedia} onPositionChange={setPosition} />
          : personalContext && <InfoCardEmptyPanel id={id} pouch={source} closing={closing} settled={hadCards} disabled={mutation || !!authoring}
            addRef={closeButton} onAdd={() => void edit()} onExited={onClose} />}
      </div>}
      {(status === "failed" || status === "pending" && loadingMessage) && <p className={styles.status} style={statusStyle}
        role={status === "failed" ? "alert" : "status"}>{status === "failed" ? "Unable to load Info Cards." : "Loading Info Cards…"}</p>}
      {error && <p role="alert" className={styles.status} style={statusStyle}>{error}</p>}
      <div className={styles.alignment} data-info-pouch-alignment="" style={{ left: pouchGeometry.left, top: pouchGeometry.top, width: pouchGeometry.width,
        height: pouchGeometry.height, borderRadius: pouchGeometry.borderRadius, transform: `scale(${pouchGeometry.scale})` }}>
        <div className={stepStyles.pouch}>
          <InfoCardPouch count={count} allowEmpty={!!personalContext} position={count ? position : 0} expanded={status === "ready"} pending={status !== "ready"} controlsId={id}
            onToggle={() => { if (!media && !authoring && !mutation) { if (hasSurface) setClosing(value => !value); else onClose(); } }} />
        </div>
      </div>
    </dialog>
    {media?.media ? media.publication
      ? <InfoCardRemoteMediaViewer media={media.media} context={media.publication} actor={actor ?? ""} onClose={() => setMedia(null)} returnFocus={mediaSource} />
      : <InfoCardMediaViewer media={media.media} onClose={() => setMedia(null)} returnFocus={mediaSource} /> : null}
    {authoring && actor && personalContext && <PersonalInfoEditorDialog key={authoring.id} {...authoring} actor={actor}
      context={{ originCardTemplateId: authoring.origin, context: authoring.origin === personalContext.mainCardId ? {
        deckTemplateId: personalContext.deckTemplateId, version: personalContext.version, personalInfoRevision: personalContext.personalInfoRevision } : undefined }}
      onCancel={() => {
        setAuthoring(null);
        // Native nested-dialog restoration can run before the pack loses inert.
        // Restore after that commit to the same persistent contextual control.
        requestAnimationFrame(() => dialog.current?.querySelector<HTMLButtonElement>('[data-info-card-current="true"] [aria-label="Info Card actions"], [data-info-empty-panel] button')?.focus({ preventScroll: true }));
      }} onSaved={async (savedId, association) => {
        if (!live.current) return;
        acceptAssociation(association);
        const oldIndex = cards.findIndex(card => card.id === savedId);
        const successors = oldIndex >= 0 ? cards.slice(oldIndex + 1).concat(cards.slice(0, oldIndex)).map(card => card.id) : [];
        const firstCard = cards.length === 0;
        await onRefresh?.(savedId, successors);
        if (live.current) { if (firstCard) focusAfterOpening.current = true; setAuthoring(null); if (!firstCard) requestAnimationFrame(() => dialog.current?.querySelector<HTMLButtonElement>('[data-info-card-current="true"] [aria-label="Info Card actions"]')?.focus({ preventScroll: true })); }
      }} />}
  </>, document.body);
}

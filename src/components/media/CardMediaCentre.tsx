"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { AnimatePresence, motion } from "motion/react";
import { createPortal } from "react-dom";
import { fetchMediaCentreMetadata } from "@/lib/mediaCollection/transport";
import { useMediaCollection } from "./useMediaCollection";
import { collectionDisplayItem, collectionTarget } from "@/lib/mediaCollection/presentation";
import { collectionKey, type MediaCollectionContext, type MediaCollectionItem } from "@/lib/mediaCollection/contracts";
import { mediaRemoveOperation, type MediaCapabilities } from "@/lib/mediaCollection/permissions";
import { GroupMediaUpload, mutateCollectionItem, type GroupUploadContext } from "@/lib/mediaCollection/operations";
import { useKeyedUserCardMediaUploadController, initialUserCardMediaUploadState, type CompletedUserCardMediaUpload, type UserCardMediaUploadTarget } from "./useKeyedUserCardMediaUploadController";
import UserCardMediaUploadPanel, { type UserCardMediaRemovalState } from "./UserCardMediaUploadPanel";
import { personalMediaKey, type PersonalMediaDisplayItem } from "@/lib/cards/personalHistoryProjection";
import { isImageMediaItem, isVideoMediaItem, type MediaItem } from "@/lib/media";
import type { ModernUserCardMediaItem } from "@/lib/userCardMedia";
import { workingCardStore } from "@/lib/cards/workingCardStore";
import { personalWork } from "@/lib/cards/personalWork";
const hideNotice = "Removed from this Group. The creator still has their copy.";

// The existing Media Centre shell and rails, fed by the shared source-aware
// collection. It is deliberately separate from the thumbnail-opened Gallery.
export default function CardMediaCentre({ context, personalTarget, groupUpload, legacyItems = [], onPersonalUpload, onPersonalRemove, onClose, backgroundRef, sourceRef, suspended = false }: {
  suspended?: boolean; context: MediaCollectionContext; personalTarget?: UserCardMediaUploadTarget; groupUpload?: GroupUploadContext;
  legacyItems?: PersonalMediaDisplayItem[];
  onPersonalUpload?: (target: UserCardMediaUploadTarget, item: ModernUserCardMediaItem) => Promise<void>;
  onPersonalRemove?: (target: UserCardMediaUploadTarget, id: string) => Promise<void>;
  onClose(): void; backgroundRef?: RefObject<HTMLElement | null>; sourceRef?: RefObject<HTMLButtonElement | null>;
}) {
  const collection = useMediaCollection(context, Number.MAX_SAFE_INTEGER, "", fetchMediaCentreMetadata), close = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(true);
  const [removing, setRemoving] = useState<Record<string, UserCardMediaRemovalState>>({}), [toast, setToast] = useState<string | null>(null);
  const [groupState, setGroupState] = useState(initialUserCardMediaUploadState);
  const mounted = useRef(true), pending = useRef(new Map<string, { operation: GroupMediaUpload; abort: AbortController; fileKey: string }>());
  const scopeKey = JSON.stringify(context);
  useLayoutEffect(() => {
    const background = backgroundRef?.current?.closest<HTMLElement>(".app-shell") ?? document.querySelector<HTMLElement>(".app-shell");
    const inert = background?.inert, source = sourceRef?.current, oldOverflow = document.body.style.overflow;
    background?.setAttribute("inert", ""); document.body.style.overflow = "hidden"; close.current?.focus({ preventScroll: true });
    return () => { if (!inert) background?.removeAttribute("inert"); document.body.style.overflow = oldOverflow; if (source?.isConnected) source.focus({ preventScroll: true }); };
  }, [backgroundRef, sourceRef]);
  useEffect(() => { mounted.current = true; const uploads = pending.current; return () => { mounted.current = false; uploads.forEach(v => v.abort.abort()); }; }, [scopeKey]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(null), 5000); return () => clearTimeout(timer); }, [toast]);
  const uploadFinishes = useRef(new Map<string, ReturnType<typeof personalWork.begin>>());
  const removalInFlight = useRef(new Set<string>());
  const completed = useCallback(async ({ target, mediaItem }: CompletedUserCardMediaUpload) => {
    if (!onPersonalUpload) throw Error("Personal upload unavailable."); await onPersonalUpload(target, mediaItem);
    if (mounted.current) await collection.controller?.load();
  }, [onPersonalUpload, collection.controller]);
  const personal = useKeyedUserCardMediaUploadController({ onUploadCompleted: completed,
    onUploadStarted: (target, kind) => {
      if (target.userId) uploadFinishes.current.set(`${target.cardId}:${kind}`, personalWork.begin({ userId: target.userId, cardIds: [target.cardId] }, `upload:${target.cardId}:${kind}`));
    },
    onUploadSettled: (target, kind, error, retry) => { const key = `${target.cardId}:${kind}`; uploadFinishes.current.get(key)?.(error, retry); uploadFinishes.current.delete(key); },
  });
  const caps: MediaCapabilities = collection.page?.capabilities ?? { canUpload: Boolean(personalTarget && onPersonalUpload), canManage: context.kind === "owner", canRemoveOwn: true, canHideOthers: false };
  const canUpload = Boolean((personalTarget && onPersonalUpload) || (groupUpload && caps.canUpload));
  const values = collection.page?.items;
  const items = values ? values.map(i => collectionDisplayItem(i, context)) : context.kind === "owner" && !context.experienceId ? legacyItems : [];
  const operation = (item: MediaItem) => {
    const display = item as PersonalMediaDisplayItem;
    const value: MediaCollectionItem = display.collection ?? { source: { kind: "personal", cardTemplateId: display.sourceCardTemplateId ?? context.cardTemplateId, mediaItemId: display.id },
      authorUserId: context.viewerUserId, mediaType: display.mediaType, description: display.description, uploadedAt: null, originName: "Personal", private: false };
    return { value, action: mediaRemoveOperation(context.viewerUserId, value, caps, context.experienceId) };
  };
  const remove = async (item: MediaItem) => {
    const { value, action } = operation(item), key = personalMediaKey(item as PersonalMediaDisplayItem);
    if (!action || removalInFlight.current.has(key)) return;
    removalInFlight.current.add(key);
    setRemoving(s => ({ ...s, [key]: { isRemoving: true, error: null } }));
    try {
      if (action === "delete" && value.source.kind === "personal" && personalTarget && onPersonalRemove) await onPersonalRemove({ ...personalTarget, cardId: value.source.cardTemplateId }, value.source.mediaItemId);
      else await personalWork.run({ userId: context.viewerUserId, cardIds: [context.cardTemplateId], ...(value.source.kind === "group" ? { context: { kind: "experience-contribution" as const, experienceId: value.source.experienceId } } : {}) }, `remove:${collectionKey(value)}`, () => mutateCollectionItem(context, value, action));
      if (action === "delete" && value.source.kind === "personal") workingCardStore.removeMedia(context.viewerUserId, value.source.cardTemplateId, value.source.mediaItemId);
      if (mounted.current) { if (action === "hide") setToast(hideNotice); await collection.controller?.refresh(); }
    } catch (error) { if (mounted.current) setRemoving(s => ({ ...s, [key]: { isRemoving: false, error: error instanceof Error ? error.message : "Unable to remove media." } })); }
    finally { removalInFlight.current.delete(key); if (mounted.current) setRemoving(s => s[key]?.error ? s : { ...s, [key]: { isRemoving: false, error: null } }); }
  };
  const upload = async (kind: "image" | "video", file: File) => {
    if (!canUpload) return;
    if (personalTarget) { await (kind === "image" ? personal.uploadImage : personal.uploadVideo)(personalTarget, file); return; }
    if (!groupUpload) return;
    const fileKey = JSON.stringify([file.name, file.type, file.size, file.lastModified]);
    let entry = pending.current.get(kind);
    if (!entry || entry.fileKey !== fileKey) { entry?.abort.abort(); entry = { operation: new GroupMediaUpload(groupUpload, file), abort: new AbortController(), fileKey }; pending.current.set(kind, entry); }
    setGroupState(s => ({ ...s, [kind === "image" ? "isImageUploading" : "isVideoUploading"]: true, [`${kind}UploadStage`]: "uploading", [`${kind}Error`]: null }));
    let finish: ReturnType<typeof personalWork.begin> | undefined;
    try { finish = personalWork.begin({ userId: context.viewerUserId, cardIds: [context.cardTemplateId], context: { kind: "experience-contribution", experienceId: groupUpload.experienceId } }, `upload:${entry.operation.operationId}`);
    await entry.operation.run(entry.abort.signal); finish(); pending.current.delete(kind); if (mounted.current) await collection.controller?.load(); }
    catch (error) { finish?.(); if (mounted.current && !entry.abort.signal.aborted) setGroupState(s => ({ ...s, [`${kind}Error`]: error instanceof Error ? error.message : "Upload failed." })); }
    finally { if (mounted.current) setGroupState(s => ({ ...s, [kind === "image" ? "isImageUploading" : "isVideoUploading"]: false, [`${kind}UploadStage`]: "idle" })); }
  };
  const target: UserCardMediaUploadTarget = personalTarget ?? { scope: "user-card", userId: context.viewerUserId, cardId: context.cardTemplateId, deckTemplateId: groupUpload?.experienceId ?? context.experienceId ?? "media-centre" };
  const privateLabels = context.kind === "owner" && Boolean(context.experienceId);
  if (typeof document === "undefined") return null;
  return createPortal(<AnimatePresence onExitComplete={onClose}>{open ? <motion.div style={{ visibility: suspended ? "hidden" : undefined }} inert={suspended} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .14 }} className="creator-modal-backdrop reflection-editor-backdrop" onKeyDown={e => { e.stopPropagation(); if (e.key === "Escape") setOpen(false);
      if (e.key === "Tab") {
        const nodes = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [tabindex="0"]')).filter(n => n.getClientRects().length);
        const first = nodes[0], last = nodes.at(-1);
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      } }} onClick={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()} onPointerMove={e => e.stopPropagation()} onPointerUp={e => e.stopPropagation()}>
    <div role="dialog" aria-modal="true" aria-labelledby="media-centre-title" className="creator-modal creator-modal--deck-introduction card-media-upload-modal">
      <header className="creator-modal-header"><p id="media-centre-title">Card media</p><button ref={close} className="creator-modal-close" type="button" onClick={() => setOpen(false)}>Close</button></header>
      {collection.error && !legacyItems.length ? <p role="alert" className="creator-modal-error">{collection.error}</p> : null}
      <UserCardMediaUploadPanel images={items.filter(isImageMediaItem)} videos={items.filter(isVideoMediaItem)} target={target}
        uploadState={personalTarget ? personal.getState(personalTarget) : groupState} removalStatesById={removing} canUpload={canUpload}
        canRemoveMedia={item => Boolean(operation(item).action)} showPrivate={privateLabels}
        getMediaKey={item => personalMediaKey(item as PersonalMediaDisplayItem)}
        getReadinessTarget={item => (item as PersonalMediaDisplayItem).collection ? collectionTarget(item as PersonalMediaDisplayItem, { viewerUserId: context.viewerUserId, cardTemplateId: context.cardTemplateId, sourceCardTemplateId: (item as PersonalMediaDisplayItem).sourceCardTemplateId ?? context.cardTemplateId, mediaItemId: item.id }, context) : undefined}
        onAddImage={file => void upload("image", file)} onAddVideo={file => void upload("video", file)} onRemoveMedia={item => void remove(item)} />
      {toast ? <p role="status" className="media-removal-toast">{toast}</p> : null}
    </div>
  </motion.div> : null}</AnimatePresence>, document.body);
}

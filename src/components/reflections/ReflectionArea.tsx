"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import BackCardReflectionFragment from "@/components/decks/BackCardReflectionFragment";
import { currentContextReflection, memberReflectionItems } from "@/lib/reflections/presentation";
import { reflectionSlotKey, type ReflectionSource, type CollectiveReflectionSource } from "@/lib/reflections/model";
import type { ReflectionFeed, ReflectionView } from "@/lib/reflections/reads";
import { personalWork } from "@/lib/cards/personalWork";
import { workingCardStore } from "@/lib/cards/workingCardStore";
import { patchReflectionFeed } from "@/lib/reflections/clientState";
import { clientId } from "@/lib/clientId";
import ReflectionModal from "./ReflectionModal";
import "./reflections.css";

type EditorTarget = { source: ReflectionSource | CollectiveReflectionSource; text: string; revision: number; canEdit: boolean; canDelete: boolean; explanation: string | null };

export type ReflectionAreaContext = { viewerUserId: string; cardTemplateId: string; view: ReflectionView; deckTemplateId?: string; adoptionRevision?: number };
export default function ReflectionArea({ context, active = true, interactive = true, verticalOffset = 0, onModalChange }: {
  context: ReflectionAreaContext; active?: boolean; interactive?: boolean; verticalOffset?: number; onModalChange?(open: boolean): void;
}) {
  // Mount identity is the complete viewer/context/source authority, never Card alone.
  return <ReflectionAreaSession key={JSON.stringify(context)} context={context} active={active} interactive={interactive} verticalOffset={verticalOffset} onModalChange={onModalChange} />;
}
function ReflectionAreaSession({ context, active, interactive, verticalOffset, onModalChange }: {
  context: ReflectionAreaContext; active: boolean; interactive: boolean; verticalOffset: number; onModalChange?: (open: boolean) => void;
}) {
  const [feed, setFeed] = useState<ReflectionFeed | null>(null), [selected, setSelected] = useState<string | null>(null);
  const [modal, setModal] = useState<EditorTarget | null>(null), [draft, setDraft] = useState(""), [error, setError] = useState<string | null>(null), [saving, setSaving] = useState(false);
  const [fading, setFading] = useState(false), [reduced, setReduced] = useState(false);
  const alive = useRef(true), requestId = useRef(0), mutation = useRef<{ action: string; operationId: string; text: string } | null>(null);
  const pendingSave = useRef(false), eventOrigin = useRef({});
  const ownedPointer = useRef<number | null>(null), pendingMember = useRef<string | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null), source = useRef<HTMLDivElement>(null);
  const { viewerUserId: actor, cardTemplateId: card, view } = context;
  const group = view.kind === "group", groupWide = group && view.mode === "group";
  const own = !group || view.mode === "own";
  const session = useRef(workingCardStore.session(actor));
  const live = useCallback(() => alive.current && workingCardStore.session(actor) === session.current, [actor]);
  const refresh = useCallback(async () => {
    if (pendingSave.current) return;
    const generation = ++requestId.current;
    const params = new URLSearchParams({ cardTemplateId: card });
    if (view.kind === "group") { params.set("experienceId", view.experienceId); params.set("mode", view.mode); params.set("accessEpoch", String(view.accessEpoch)); if (view.subjectUserId) params.set("subjectUserId", view.subjectUserId); }
    try {
      const response = await fetch(`/api/reflections?${params}`, { cache: "no-store", headers: { "X-Personal-Viewer": actor, ...(group ? { "X-Group-Viewer": actor } : {}) } });
      const result = await response.json();
      if (!live() || generation !== requestId.current) return;
      if (!response.ok || result.viewerUserId !== actor || result.cardTemplateId !== card || (result.view?.kind !== view.kind || (view.kind === "group" && (result.view.experienceId !== view.experienceId || result.view.mode !== view.mode || result.view.subjectUserId !== view.subjectUserId || result.view.accessEpoch !== view.accessEpoch)))
        || (context.adoptionRevision !== undefined && result.adoptionRevision !== context.adoptionRevision)) {
        setFeed(null); setModal(null); throw Error("Current reflection access could not be verified.");
      }
      setFeed(result);
    } catch (e) { if (live() && generation === requestId.current) { if (!own) { setFeed(null); setModal(null); } setError(e instanceof Error ? e.message : "Unable to load reflections."); } }
  }, [actor, card, view, context.adoptionRevision, group, live, own]);
  const refreshRef = useRef(refresh);
  useEffect(() => { refreshRef.current = refresh; }, [refresh]);
  useEffect(() => {
    alive.current = true; void refreshRef.current();
    const reload = (event?: Event) => {
      const detail = event instanceof CustomEvent ? event.detail : undefined;
      if (detail?.origin === eventOrigin.current || (detail && (detail.actor !== actor || detail.card !== card))) return;
      if (document.visibilityState !== "hidden") void refreshRef.current();
    };
    const timer = setInterval(reload, 5000);
    window.addEventListener("focus", reload); window.addEventListener("switchplay-reflections", reload); document.addEventListener("visibilitychange", reload);
    return () => { alive.current = false; clearInterval(timer); window.removeEventListener("focus", reload); window.removeEventListener("switchplay-reflections", reload); document.removeEventListener("visibilitychange", reload); if (timeout.current) clearTimeout(timeout.current); };
  }, [actor, card]);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)"), change = () => setReduced(media.matches);
    change(); media.addEventListener("change", change); return () => media.removeEventListener("change", change);
  }, []);
  useEffect(() => { onModalChange?.(!!modal); return () => onModalChange?.(false); }, [modal, onModalChange]);
  useEffect(() => {
    if (!modal || (!modal.canEdit && !modal.canDelete)) return;
    return personalWork.begin({ userId: actor, cardIds: [card], ...(modal.source.kind !== "personal" ? { context: { kind: "experience-contribution" as const, experienceId: modal.source.experienceId } } : {}) }, `reflection-editor:${JSON.stringify(modal.source)}`);
  }, [actor, card, modal]);
  const items = useMemo(() => feed?.items ?? [], [feed]);
  const displayContext = useMemo(() => ({ ...view, viewerUserId: actor, cardTemplateId: card }), [view, actor, card]);
  const selectedItem = groupWide ? null : currentContextReflection(displayContext, items,
    view.kind === "group" && view.mode === "inspection" ? view.subjectUserId : actor);
  const members = useMemo(() => groupWide && displayContext.kind === "group" ? memberReflectionItems(displayContext, items) : [], [groupWide, displayContext, items]);
  if (members.length && !members.some(i => reflectionSlotKey(i.entry) === selected)) setSelected(reflectionSlotKey(members[0].entry));
  else if (!members.length && selected !== null) setSelected(null);
  const selectedMember = members.find(i => reflectionSlotKey(i.entry) === selected) ?? members[0];
  const advance = () => {
    if (members.length < 2 || !interactive || !active || modal) return;
    const from = pendingMember.current ?? selected;
    const index = Math.max(0, members.findIndex(i => reflectionSlotKey(i.entry) === from));
    const next = reflectionSlotKey(members[(index + 1) % members.length].entry);
    pendingMember.current = next;
    const step = () => { setSelected(next); pendingMember.current = null; setFading(false); };
    if (!reduced) { if (timeout.current) clearTimeout(timeout.current); setFading(true); timeout.current = setTimeout(step, 200); } else step();
  };
  const current: EditorTarget | null = groupWide ? feed?.collective ? { ...feed.collective, canDelete: false, explanation: null } : null
    : selectedItem ? { source: selectedItem.entry.source, text: selectedItem.entry.text, revision: selectedItem.entry.revision, canEdit: selectedItem.canEdit, canDelete: selectedItem.canDelete, explanation: selectedItem.explanation } : null;
  const open = () => { if (!interactive || !active || !current) return; setModal(current); setDraft(current.text); setError(null); mutation.current = null; };
  const close = () => { if (!saving) setModal(null); };
  const apply = async (action: "save" | "delete") => {
    if (!modal || !feed || pendingSave.current || saving || (!interactive && action !== "delete")) return;
    const item = modal;
    if (!(action === "save" ? item.canEdit : item.canDelete)) return;
    const text = draft.trim();
    if (!mutation.current || mutation.current.action !== action || mutation.current.text !== text) mutation.current = { action, text, operationId: clientId() };
    const operation = mutation.current;
    const previous = feed, submitted = action === "delete" ? "" : text;
    pendingSave.current = true; ++requestId.current;
    setFeed(patchReflectionFeed(previous, item.source, submitted));
    setSaving(true); setError(null);
    try {
      const response = await fetch("/api/reflections", { method: "POST", headers: { "Content-Type": "application/json", "X-Personal-Viewer": actor, ...(group ? { "X-Group-Viewer": actor } : {}) },
        body: JSON.stringify({ action, source: item.source, text, operationId: operation.operationId, expectedRevision: item.revision,
          ...(view.kind === "group" ? { accessEpoch: view.accessEpoch } : {}), ...(context.deckTemplateId ? { deckTemplateId: context.deckTemplateId } : {}) }) });
      const result = await response.json(); if (!live()) return;
      if (!response.ok) throw Error(result.code?.includes("CONFLICT") ? "This reflection changed. Close and reopen it before trying again." : "Unable to save this reflection. Check your access and try again.");
      if (!Number.isSafeInteger(result.revision) || result.revision < item.revision) throw Error("Unable to verify the saved reflection. Try again.");
      ++requestId.current;
      setFeed(patchReflectionFeed(previous, item.source, submitted, result));
      if (item.source.kind === "personal") workingCardStore.invalidateLearning(actor, card);
      setModal(null); mutation.current = null;
      window.dispatchEvent(new CustomEvent("switchplay-reflections", { detail: { origin: eventOrigin.current, actor, card } }));
    } catch (e) {
      if (live()) {
        ++requestId.current; setFeed(previous);
        setError(e instanceof Error ? e.message : "Unable to update reflection.");
        // Reconcile a conflict/ambiguous network failure without discarding the
        // editor draft. A later reopening then uses the current server revision.
        pendingSave.current = false; void refreshRef.current();
      }
    } finally { pendingSave.current = false; if (live()) setSaving(false); }
  };
  if (!current && !selectedMember) return null;
  return <div className="reflection-card-notes" ref={source}
    onPointerDown={e => { ownedPointer.current = e.pointerId; e.stopPropagation(); }}
    onPointerMove={e => { if (ownedPointer.current === e.pointerId) e.stopPropagation(); }}
    onPointerUp={e => { if (ownedPointer.current === e.pointerId) { e.stopPropagation(); ownedPointer.current = null; } }}
    onPointerCancel={e => { if (ownedPointer.current === e.pointerId) { e.stopPropagation(); ownedPointer.current = null; } }}>
    {current ? <div className="reflection-area" style={{ "--reflection-y-offset": `${verticalOffset}px` } as import("react").CSSProperties}>
      <BackCardReflectionFragment text={current.text} isEditable={interactive && active} onClick={open}
        showPlaceholder={!current.text.trim() && current.canEdit} ariaLabel={!current.text.trim() ? "Add a reflection" : "Open reflection"} />
    </div> : null}
    {groupWide && selectedMember ? <div className={`reflection-member-area${fading ? " reflection-member-area--fading" : ""}`} style={{ "--reflection-y-offset": `${verticalOffset}px` } as import("react").CSSProperties}>
      <BackCardReflectionFragment prefix={`${selectedMember.entry.authorName}: `} text={selectedMember.entry.text} isEditable={members.length > 1 && interactive && active}
        onClick={advance} ariaLabel="Next member reflection" />
    </div> : null}
    {modal ? <ReflectionModal text={draft} editable={modal.canEdit && interactive} canDelete={modal.canDelete} explanation={modal.explanation} error={error} saving={saving}
      onChange={setDraft} onSave={() => void apply("save")} onDelete={() => void apply("delete")} onClose={close} /> : null}
  </div>;
}

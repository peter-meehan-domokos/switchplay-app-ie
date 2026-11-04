"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import BackCardReflectionFragment from "@/components/decks/BackCardReflectionFragment";
import { reflectionSlotKey } from "@/lib/reflections/model";
import type { ReflectionFeed, ReflectionItem, ReflectionView } from "@/lib/reflections/reads";
import { personalWork } from "@/lib/cards/personalWork";
import { workingCardStore } from "@/lib/cards/workingCardStore";
import ReflectionModal from "./ReflectionModal";
import ReflectionNextIcon from "./ReflectionNextIcon";
import "./reflections.css";

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
  const [modal, setModal] = useState<ReflectionItem | null>(null), [draft, setDraft] = useState(""), [error, setError] = useState<string | null>(null), [saving, setSaving] = useState(false);
  const [fading, setFading] = useState(false), [paused, setPaused] = useState(false), [reduced, setReduced] = useState(false);
  const alive = useRef(true), requestId = useRef(0), mutation = useRef<{ action: string; operationId: string; text: string } | null>(null);
  const ownedPointer = useRef<number | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null), source = useRef<HTMLDivElement>(null);
  const { viewerUserId: actor, cardTemplateId: card, view } = context;
  const group = view.kind === "group", autoplay = group && view.mode === "group";
  const own = !group || view.mode === "own";
  const session = useRef(workingCardStore.session(actor));
  const live = useCallback(() => alive.current && workingCardStore.session(actor) === session.current, [actor]);
  const refresh = useCallback(async () => {
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
      setFeed(result); setError(null);
    } catch (e) { if (live() && generation === requestId.current) { if (!own) { setFeed(null); setModal(null); } setError(e instanceof Error ? e.message : "Unable to load reflections."); } }
  }, [actor, card, view, context.adoptionRevision, group, live, own]);
  const refreshRef = useRef(refresh);
  useEffect(() => { refreshRef.current = refresh; }, [refresh]);
  useEffect(() => {
    alive.current = true; void refreshRef.current();
    const reload = () => { if (document.visibilityState !== "hidden") void refreshRef.current(); };
    const timer = setInterval(reload, 5000);
    window.addEventListener("focus", reload); window.addEventListener("switchplay-reflections", reload); document.addEventListener("visibilitychange", reload);
    return () => { alive.current = false; clearInterval(timer); window.removeEventListener("focus", reload); window.removeEventListener("switchplay-reflections", reload); document.removeEventListener("visibilitychange", reload); if (timeout.current) clearTimeout(timeout.current); };
  }, []);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)"), change = () => setReduced(media.matches);
    change(); media.addEventListener("change", change); return () => media.removeEventListener("change", change);
  }, []);
  useEffect(() => { onModalChange?.(!!modal); return () => onModalChange?.(false); }, [modal, onModalChange]);
  useEffect(() => {
    if (!modal || modal.entry.authorUserId !== actor) return;
    return personalWork.begin({ userId: actor, cardIds: [card], ...(modal.entry.source.kind === "group" ? { context: { kind: "experience-contribution" as const, experienceId: modal.entry.source.experienceId } } : {}) }, `reflection-editor:${reflectionSlotKey(modal.entry)}`);
  }, [actor, card, modal]);
  const items = useMemo(() => feed?.items ?? [], [feed]), selectedItem = items.find(i => reflectionSlotKey(i.entry) === selected) ?? items[0];
  const advance = useCallback(() => {
    if (items.length < 2) return;
    const step = () => { const index = selected === null ? 0 : Math.max(0, items.findIndex(i => reflectionSlotKey(i.entry) === selected)); setSelected(reflectionSlotKey(items[(index + 1) % items.length].entry)); setFading(false); };
    if (autoplay && !reduced) { if (timeout.current) clearTimeout(timeout.current); setFading(true); timeout.current = setTimeout(step, 200); } else step();
  }, [items, selected, autoplay, reduced]);
  const advanceRef = useRef(advance);
  useEffect(() => { advanceRef.current = advance; }, [advance]);
  useEffect(() => {
    if (!autoplay || reduced || !active || paused || modal || items.length < 2) return;
    const timer = setInterval(() => { if (document.visibilityState === "visible" && !source.current?.closest('[aria-hidden="true"]')) advanceRef.current(); }, 5000);
    return () => clearInterval(timer);
  }, [autoplay, reduced, active, paused, modal, items.length]);
  const open = () => { if (!interactive || !selectedItem) return; setModal(selectedItem); setDraft(selectedItem.entry.text); setError(null); mutation.current = null; };
  const close = () => { if (!saving) setModal(null); };
  const apply = async (action: "save" | "delete" | "hide") => {
    if (!modal || saving || (!interactive && action !== "delete")) return;
    const item = modal;
    if (!(action === "save" ? item.canEdit : action === "delete" ? item.canDelete : item.canHide)) return;
    const text = draft.trim();
    if (!mutation.current || mutation.current.action !== action || mutation.current.text !== text) mutation.current = { action, text, operationId: crypto.randomUUID() };
    const operation = mutation.current;
    setSaving(true); setError(null);
    try {
      const response = await fetch("/api/reflections", { method: "POST", headers: { "Content-Type": "application/json", "X-Personal-Viewer": actor, ...(group ? { "X-Group-Viewer": actor } : {}) },
        body: JSON.stringify({ action, source: item.entry.source, text, operationId: operation.operationId, expectedRevision: item.entry.revision,
          ...(view.kind === "group" ? { accessEpoch: view.accessEpoch } : {}), ...(context.deckTemplateId ? { deckTemplateId: context.deckTemplateId } : {}) }) });
      const result = await response.json(); if (!live()) return;
      if (!response.ok) throw Error(result.code?.includes("CONFLICT") ? "This reflection changed. Close and reopen it before trying again." : "Unable to save this reflection. Check your access and try again.");
      if (item.entry.source.kind === "personal") workingCardStore.invalidateLearning(actor, card);
      setModal(null); mutation.current = null; await refreshRef.current(); window.dispatchEvent(new Event("switchplay-reflections"));
    } catch (e) { if (live()) setError(e instanceof Error ? e.message : "Unable to update reflection."); }
    finally { if (live()) setSaving(false); }
  };
  if (!selectedItem) return null;
  return <div ref={source} className={`reflection-area${autoplay ? " reflection-area--group" : ""}`} style={{ "--reflection-y-offset": `${verticalOffset}px` } as import("react").CSSProperties}
    onPointerDown={e => { ownedPointer.current = e.pointerId; e.stopPropagation(); }}
    onPointerMove={e => { if (ownedPointer.current === e.pointerId) e.stopPropagation(); }}
    onPointerUp={e => { if (ownedPointer.current === e.pointerId) { e.stopPropagation(); ownedPointer.current = null; } }}
    onPointerCancel={e => { if (ownedPointer.current === e.pointerId) { e.stopPropagation(); ownedPointer.current = null; } }}
    onFocusCapture={() => setPaused(true)} onBlurCapture={e => { if (!e.currentTarget.contains(e.relatedTarget)) setPaused(false); }}>
    <div className={`reflection-area-content${fading ? " reflection-area-content--fading" : ""}`}>
      <BackCardReflectionFragment text={selectedItem.entry.text} isEditable={interactive} onClick={open} showPlaceholder={selectedItem.empty} ariaLabel={selectedItem.empty ? "Add a reflection" : "Open reflection"} />
      {selectedItem.label || selectedItem.private ? <span className="reflection-context">{selectedItem.label}{selectedItem.private ? " · Private" : ""}</span> : null}
    </div>
    {items.length > 1 && interactive ? <button type="button" className="reflection-next" aria-label="Next reflection" onClick={e => { e.stopPropagation(); advance(); }}><ReflectionNextIcon /></button> : null}
    {modal ? <ReflectionModal text={draft} editable={modal.canEdit && interactive} canDelete={modal.canDelete} canHide={modal.canHide && interactive} explanation={modal.explanation} error={error} saving={saving}
      onChange={setDraft} onSave={() => void apply("save")} onDelete={() => void apply("delete")} onHide={() => void apply("hide")} onClose={close} /> : null}
  </div>;
}

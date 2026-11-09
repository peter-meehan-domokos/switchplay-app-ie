"use client";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import BackCardReflectionFragment from "@/components/decks/BackCardReflectionFragment";
import { currentContextReflection, memberReflectionItems } from "@/lib/reflections/presentation";
import { reflectionSlotKey, type ReflectionSource, type CollectiveReflectionSource } from "@/lib/reflections/model";
import { retainedReflection, type ReflectionAreaContext } from "@/lib/reflections/controller";
export type { ReflectionAreaContext } from "@/lib/reflections/controller";
import { personalWork } from "@/lib/cards/personalWork";
import { workingCardStore } from "@/lib/cards/workingCardStore";
import ReflectionModal from "./ReflectionModal";
import type { GroupRefreshOwner } from "@/lib/groupExperiences/refreshOwner";
import "./reflections.css";

type EditorTarget = { source: ReflectionSource | CollectiveReflectionSource; text: string; revision: number; canEdit: boolean; canDelete: boolean; explanation: string | null };

export default function ReflectionArea({ context, active = true, interactive = true, verticalOffset = 0, onModalChange, refreshOwner }: {
  refreshOwner?: GroupRefreshOwner;
  context: ReflectionAreaContext; active?: boolean; interactive?: boolean; verticalOffset?: number; onModalChange?(open: boolean): void;
}) {
  // Mount identity is the complete viewer/context/source authority, never Card alone.
  return <ReflectionAreaSession key={JSON.stringify(context)} context={context} active={active} interactive={interactive} verticalOffset={verticalOffset} onModalChange={onModalChange} refreshOwner={refreshOwner} />;
}
function ReflectionAreaSession({ context, active, interactive, verticalOffset, onModalChange, refreshOwner }: {
  refreshOwner?: GroupRefreshOwner;
  context: ReflectionAreaContext; active: boolean; interactive: boolean; verticalOffset: number; onModalChange?: (open: boolean) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const controller = useMemo(() => typeof window === "undefined" ? null : retainedReflection(context), [context]);
  const serverState = useMemo(() => ({ feed: null, saving: false, error: null }), []);
  const { feed, saving, error: feedError } = useSyncExternalStore(controller?.subscribe ?? (() => () => {}), controller?.snapshot ?? (() => serverState), () => serverState);
  const [modal, setModal] = useState<EditorTarget | null>(null), [draft, setDraft] = useState(""), [error, setError] = useState<string | null>(null);
  const [fading, setFading] = useState(false), [reduced, setReduced] = useState(false);
  const alive = useRef(true);
  const ownedPointer = useRef<number | null>(null), pendingMember = useRef<string | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null), source = useRef<HTMLDivElement>(null);
  const { viewerUserId: actor, cardTemplateId: card, view } = context;
  const group = view.kind === "group", groupWide = group && view.mode === "group";
  const session = useRef(workingCardStore.session(actor));
  useEffect(() => {
    if (!controller) return;
    alive.current = true; if (!controller.snapshot().feed) void controller.refresh();
    const reload = () => { if (document.visibilityState !== "hidden") void controller.refresh(); };
    const timer = !refreshOwner ? setInterval(reload, 5000) : undefined;
    if (!refreshOwner) { window.addEventListener("focus", reload); document.addEventListener("visibilitychange", reload); }
    return () => { alive.current = false; clearInterval(timer); window.removeEventListener("focus", reload); document.removeEventListener("visibilitychange", reload); if (timeout.current) clearTimeout(timeout.current); };
  }, [controller, refreshOwner]);
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
  const open = () => { if (!interactive || !active || !current) return; setModal(current); setDraft(current.text); setError(null); };
  const close = () => { if (!saving) setModal(null); };
  const apply = async (action: "save" | "delete") => {
    if (!controller || !modal || !feed || saving || (!interactive && action !== "delete")) return;
    if (!(action === "save" ? modal.canEdit : modal.canDelete)) return;
    setError(null);
    try {
      await controller.save(modal.source, draft.trim(), modal.revision, action, context.deckTemplateId);
      if (alive.current && workingCardStore.session(actor) === session.current) setModal(null);
    } catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : "Unable to update reflection."); }
  };
  if (!current && !selectedMember) return null;
  return <div className="reflection-card-notes" ref={source}
    onPointerDown={interactive && active ? e => { ownedPointer.current = e.pointerId; e.stopPropagation(); } : undefined}
    onPointerMove={interactive && active ? e => { if (ownedPointer.current === e.pointerId) e.stopPropagation(); } : undefined}
    onPointerUp={interactive && active ? e => { if (ownedPointer.current === e.pointerId) { e.stopPropagation(); ownedPointer.current = null; } } : undefined}
    onPointerCancel={interactive && active ? e => { if (ownedPointer.current === e.pointerId) { e.stopPropagation(); ownedPointer.current = null; } } : undefined}>
    {current ? <div className="reflection-area" style={{ "--reflection-y-offset": `${verticalOffset}px` } as import("react").CSSProperties}>
      <BackCardReflectionFragment text={current.text} isEditable={interactive && active} onClick={open}
        showPlaceholder={!current.text.trim() && current.canEdit} ariaLabel={!current.text.trim() ? "Add a reflection" : "Open reflection"} />
    </div> : null}
    {groupWide && selectedMember ? <div className={`reflection-member-area${fading ? " reflection-member-area--fading" : ""}`} style={{ "--reflection-y-offset": `${verticalOffset}px` } as import("react").CSSProperties}>
      <BackCardReflectionFragment prefix={`${selectedMember.entry.authorName}: `} text={selectedMember.entry.text} isEditable={members.length > 1 && interactive && active}
        onClick={advance} ariaLabel="Next member reflection" />
    </div> : null}
    {modal ? <ReflectionModal text={draft} editable={modal.canEdit && interactive} canDelete={modal.canDelete} explanation={modal.explanation} error={error ?? feedError} saving={saving}
      onChange={setDraft} onSave={() => void apply("save")} onDelete={() => void apply("delete")} onClose={close} /> : null}
  </div>;
}

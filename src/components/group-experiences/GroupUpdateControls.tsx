"use client";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { GroupUpdateCommand } from "@/lib/groupExperiences/model";
import type { ExperienceDeckPresentation } from "@/components/decks/presentation";
import { personalWork, type PersonalWorkScope } from "@/lib/cards/personalWork";
import { clientId } from "@/lib/clientId";
import { UpdateButton } from "@/components/decks/useWorkingUpdates";
import LibraryDialog from "@/components/library/LibraryDialog";
import { groupFetch, GroupRequestError } from "./groupClient";

type Review = { command: GroupUpdateCommand; title: string; notes: { version: number; updateNote: string }[] };
type Result = { viewerUserId: string; experienceId: string; review: Review | null };
type Controls = { deckButton: ReactNode; cardButton(id: string): ReactNode; open: boolean; error: string };
// Group commands never use Personal adoption endpoints or change owner pointers.
export default function GroupUpdateControls({ actor, experienceId, deck, enabled, onAdopted, children }: {
  actor: string; experienceId: string; deck: ExperienceDeckPresentation; enabled: boolean; onAdopted(command: GroupUpdateCommand): Promise<void>; children(controls: Controls): ReactNode;
}) {
  const [reviews, setReviews] = useState<Record<string, Review>>({}), [review, setReview] = useState<Review | null>(null);
  const [busy, setBusy] = useState(false), [stale, setStale] = useState(false), [error, setError] = useState("");
  const [waiting, setWaiting] = useState(false);
  const alive = useRef(true), running = useRef(false), generation = useRef(0);
  const preparation = useRef<AbortController | null>(null);
  const attempt = useRef<{ operationId: string; review: GroupUpdateCommand } | null>(null), committed = useRef(false);
  const base = `/api/group-experiences/${encodeURIComponent(experienceId)}/updates`;
  const signature = JSON.stringify([deck.deckTemplateId, deck.version, deck.cards.map(c => [c.id, c.version])]);
  const selections = useRef<{ kind: "card" | "deck"; id: string }[]>([]);
  useEffect(() => { selections.current = [{ kind: "deck", id: deck.deckTemplateId }, ...deck.cards.map(c => ({ kind: "card" as const, id: c.id }))]; }, [deck]);
  const read = useCallback((kind: "card" | "deck", id: string, signal?: AbortSignal) => groupFetch<Result>(actor,
    `${base}?${new URLSearchParams({ kind, entityId: id, perspective: "group" })}`, signal), [actor, base]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; preparation.current?.abort(); }; }, []);
  useEffect(() => {
    if (!enabled) return;
    const abort = new AbortController(); let pending = false;
    const refresh = async () => {
      if (pending || document.visibilityState === "hidden") return;
      pending = true; const current = ++generation.current;
      try {
        const results = await Promise.all(selections.current.map(s => read(s.kind, s.id, abort.signal)));
        if (!abort.signal.aborted && alive.current && generation.current === current) setReviews(Object.fromEntries(results.flatMap(r => r.review ? [[`${r.review.command.kind}:${r.review.command.entityId}`, r.review]] : [])));
      } catch (cause) { if (!abort.signal.aborted && alive.current) setError(cause instanceof Error ? cause.message : "Unable to check Group updates."); }
      finally { pending = false; }
    };
    void refresh(); window.addEventListener("focus", refresh); window.addEventListener("pageshow", refresh); document.addEventListener("visibilitychange", refresh);
    return () => { abort.abort(); window.removeEventListener("focus", refresh); window.removeEventListener("pageshow", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [enabled, signature, read]);
  const choose = (value: Review) => { if (!enabled) return; setReview(value); setError(""); setStale(false); attempt.current = null; committed.current = false; };
  const close = () => { if (!running.current || waiting) { preparation.current?.abort(); setReview(null); setError(""); } };
  const refreshReview = async () => {
    if (!review || !enabled || running.current) return;
    running.current = true; setBusy(true);
    try { const latest = await read(review.command.kind, review.command.entityId); if (alive.current) { if (latest.review) choose(latest.review); else setReview(null); } }
    catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : "Unable to refresh Group Update."); }
    finally { running.current = false; if (alive.current) setBusy(false); }
  };
  const adopt = async () => {
    if (!review || !enabled || running.current) return;
    const retry = Boolean(error);
    running.current = true; setBusy(true); setError("");
    const abort = new AbortController(); preparation.current = abort; setWaiting(true);
    const scopes: PersonalWorkScope[] = [undefined, "experience-contribution", "experience-assessment"].map(kind => ({ userId: actor, cardIds: deck.cards.map(c => c.id),
      ...(kind ? { context: { kind: kind as "experience-contribution" | "experience-assessment", experienceId } } : {}) }));
    const unlock: (() => unknown)[] = [];
    try {
      if (retry && !committed.current) await Promise.all(scopes.map(scope => personalWork.retry(scope)));
      await Promise.all(scopes.map(scope => personalWork.wait(scope, abort.signal)));
      if (abort.signal.aborted || !alive.current) return;
      for (const scope of scopes) unlock.push(personalWork.lock(scope));
      setWaiting(false);
      if (!attempt.current) attempt.current = { operationId: clientId(), review: review.command };
      if (!committed.current) { await groupFetch(actor, base, undefined, "POST", attempt.current); committed.current = true; }
      await onAdopted(review.command);
      if (alive.current) { setReviews({}); setReview(null); attempt.current = null; }
    } catch (cause) {
      if (alive.current && !abort.signal.aborted) { setStale(cause instanceof GroupRequestError && cause.code === "GROUP_UPDATE_CONFLICT"); setError(cause instanceof GroupRequestError && cause.code === "GROUP_UPDATE_CONFLICT" ? "This update changed. Refresh the review before updating." : "Unable to finish Group Update. Retry to confirm the same update, or cancel."); }
    } finally { for (const release of unlock.reverse()) release(); running.current = false; if (alive.current) { setBusy(false); setWaiting(false); } }
  };
  return <>{children({
    deckButton: enabled && reviews[`deck:${deck.deckTemplateId}`]?.command.sourceVersion === deck.version ? <UpdateButton title={deck.title} onClick={() => choose(reviews[`deck:${deck.deckTemplateId}`])} /> : null,
    cardButton: id => enabled && reviews[`card:${id}`]?.command.sourceVersion === deck.cards.find(c => c.id === id)?.version ? <UpdateButton card title={reviews[`card:${id}`].title} onClick={() => choose(reviews[`card:${id}`])} /> : null,
    open: !!review, error: enabled ? error : "",
  })}{review && enabled ? <LibraryDialog title={`Update ${review.title}`} className="working-update-dialog" isolateInteractions onCancel={close}>
    <p>Existing progress and contributions are preserved.</p>
    {review.notes.length ? <ol>{review.notes.map(n => <li key={n.version}><span>Version {n.version}</span><p>{n.updateNote}</p></li>)}</ol> : <p>A newer version is available.</p>}
    {busy ? <p role="status">{waiting ? "Waiting for saves and uploads…" : "Updating…"}</p> : null}{error ? <p role="alert">{error}</p> : null}
    <div className="working-update-dialog-actions"><button type="button" disabled={busy && !waiting} onClick={close}>Cancel</button>
      <button type="button" disabled={busy || !enabled} onClick={() => void (stale ? refreshReview() : adopt())}>{stale ? "Refresh" : error ? "Retry" : "Update"}</button></div>
  </LibraryDialog> : null}</>;
}

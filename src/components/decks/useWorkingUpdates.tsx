"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DeckLayout } from "./deckLayout";
import type { UpdateCommand, UpdateReview, UpdateReviewResult } from "@/lib/cards/updateAdoption";
import { personalWork, type PersonalWorkScope } from "@/lib/cards/personalWork";
import { workingCardStore } from "@/lib/cards/workingCardStore";
import { updateUrl, workingRequest, WorkingRequestError } from "./updateClient";

export function UpdateButton({ card = false, title, onClick }: { card?: boolean; title: string; onClick: () => void }) {
  return <button type="button" className={`working-update-button${card ? " working-card-update" : ""}`}
    aria-label={`Update ${title}`} onPointerDown={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}
    onClick={(event) => { event.stopPropagation(); onClick(); }}><span aria-hidden="true">↻</span> Update</button>;
}

export function useWorkingUpdates(deck: DeckLayout, onAdopted: (command: UpdateCommand) => Promise<void>, enabled = true) {
  const userId = deck.dataOwnerUserId!;
  const [reviews, setReviews] = useState<Record<string, UpdateReview>>({});
  const [review, setReview] = useState<UpdateReview | null>(null);
  const [stage, setStage] = useState<"review" | "waiting" | "saving" | "refreshing" | "review-refresh" | "stale" | "error">("review");
  const [error, setError] = useState("");
  const [discoveryError, setDiscoveryError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const attempt = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const committed = useRef(false);
  const running = useRef(false);
  const activeScope = useRef<PersonalWorkScope | null>(null);
  const selectionKey = JSON.stringify([userId, deck.deckTemplateId, deck.adoptedVersion, deck.cards.map((card) => [card.id, card.adoptedVersion])]);
  const currentSelection = useRef(selectionKey);
  const readGeneration = useRef(0);
  useEffect(() => { currentSelection.current = selectionKey; }, [selectionKey]);
  const scopeFor = (selected: UpdateReview): PersonalWorkScope => ({ userId,
    ...(selected.command.kind === "deck" ? { deckId: deck.deckTemplateId } : {}),
    cardIds: selected.command.kind === "card" ? [selected.command.entityId] : deck.cards.map((card) => card.id) });
  const reloadReviews = useCallback(async (signal?: AbortSignal) => {
    if (!enabled || !userId || currentSelection.current !== selectionKey) return;
    const generation = ++readGeneration.current;
    const selections = [{ kind: "deck" as const, id: deck.deckTemplateId }, ...deck.cards.map((card) => ({ kind: "card" as const, id: card.id }))];
    const results = await Promise.all(selections.map(async ({ kind, id }) => {
      const result = await workingRequest<UpdateReviewResult>(userId, updateUrl(kind, id), "GET", undefined, signal);
      return result.review;
    }));
    if (!signal?.aborted && mounted.current && currentSelection.current === selectionKey && generation === readGeneration.current) { setDiscoveryError(""); setReviews(Object.fromEntries(results.flatMap((item) => item ? [[`${item.command.kind}:${item.command.entityId}`, item]] : []))); }
  }, [enabled, userId, deck.deckTemplateId, deck.cards, selectionKey]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; attempt.current?.abort(); };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    let reading = false;
    const refresh = () => {
      if (reading || document.visibilityState === "hidden") return;
      reading = true;
      void reloadReviews(controller.signal).catch((cause) => {
      if (!controller.signal.aborted && mounted.current) setDiscoveryError(cause instanceof Error ? cause.message : "Unable to check for updates.");
    }).finally(() => { reading = false; }); };
    refresh(); window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh); document.addEventListener("visibilitychange", refresh);
    return () => { controller.abort(); window.removeEventListener("focus", refresh); window.removeEventListener("pageshow", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [reloadReviews]);
  useEffect(() => { if (review && !dialog.current?.open) dialog.current?.showModal(); }, [review]);
  function close() {
    if (stage === "saving" || stage === "refreshing") return;
    attempt.current?.abort(); setReview(null); setError(""); dialog.current?.close();
  }
  function choose(selected: UpdateReview) {
    if (!enabled) return;
    committed.current = false; activeScope.current = scopeFor(selected);
    setStage("review"); setError(""); setReview(selected);
  }
  async function refreshReview() {
    if (!review) return;
    const controller = new AbortController(); attempt.current = controller;
    setStage("review-refresh"); setError("");
    try {
      const result = await workingRequest<UpdateReviewResult>(userId, updateUrl(review.command.kind, review.command.entityId), "GET", undefined, controller.signal);
      if (!mounted.current || controller.signal.aborted) return;
      if (!result.review) { setReview(null); dialog.current?.close(); await reloadReviews(); return; }
      setReview(result.review); activeScope.current = scopeFor(result.review); setStage("review");
    } catch (error) { if (mounted.current && !controller.signal.aborted) { setError((error as Error).message); setStage("stale"); } }
  }
  async function adopt(retry = false) {
    if (!enabled || !review || running.current || ["waiting", "saving", "refreshing", "review-refresh"].includes(stage)) return;
    running.current = true;
    const controller = new AbortController(); attempt.current = controller;
    const scope = activeScope.current!;
    let unlock: (() => unknown) | undefined;
    setError(""); setStage("waiting");
    try {
      if (retry && !committed.current) await personalWork.retry(scope);
      await personalWork.wait(scope, controller.signal);
      if (controller.signal.aborted) return;
      unlock = personalWork.lock(scope);
      if (!committed.current) {
        setStage("saving");
        // Once submitted, Cancel cannot pretend to undo the transaction. An
        // uncertain response retries this same reviewed command, never a new target.
        await workingRequest(userId, updateUrl(review.command.kind, review.command.entityId), "POST", { command: review.command }, AbortSignal.timeout(15000));
        committed.current = true;
        workingCardStore.invalidate(userId);
      }
      setStage("refreshing"); await onAdopted(review.command); await reloadReviews();
      if (mounted.current) { dialog.current?.close(); setReview(null); setStage("review"); }
    } catch (error) {
      if (controller.signal.aborted || !mounted.current) return;
      if (error instanceof WorkingRequestError && error.latestReview) { setStage("stale"); setError("A newer publication is available. Refresh this review before updating."); }
      else { setStage("error"); setError((error as Error).message); }
    } finally { unlock?.(); running.current = false; }
  }
  return {
    discoveryError,
    deckButton: enabled && reviews[`deck:${deck.deckTemplateId}`]?.command.adoptedVersion === deck.adoptedVersion ? <UpdateButton title={deck.title} onClick={() => choose(reviews[`deck:${deck.deckTemplateId}`])} /> : null,
    cardButton: (id: string) => enabled && reviews[`card:${id}`] && reviews[`card:${id}`].command.adoptedVersion === deck.cards.find((card) => card.id === id)?.adoptedVersion ? <UpdateButton card title={reviews[`card:${id}`].title} onClick={() => choose(reviews[`card:${id}`])} /> : null,
    modal: review ? <dialog ref={dialog} className="working-update-dialog" aria-labelledby="working-update-title"
      onCancel={(event) => { event.preventDefault(); close(); }}>
      <h2 id="working-update-title">Update {review.title}</h2>
      <p>Your existing personal progress is preserved.</p>
      {review.command.kind === "card" ? <p>This updates the Card everywhere you use it.</p> : null}
      {review.notes.length ? <ol>{review.notes.map((note) => <li key={note.version}><span>Version {note.version}</span><p>{note.updateNote}</p></li>)}</ol> : <p>A newer version is available.</p>}
      {stage === "waiting" ? <p role="status">Waiting for personal saves and uploads…</p> : null}
      {stage === "saving" || stage === "refreshing" || stage === "review-refresh" ? <p role="status">{stage === "saving" ? "Updating…" : "Refreshing…"}</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      <div className="working-update-dialog-actions">
        <button type="button" disabled={stage === "saving" || stage === "refreshing"} onClick={close}>Cancel</button>
        {stage === "stale" || stage === "review-refresh" ? <button type="button" disabled={stage === "review-refresh"} onClick={() => void refreshReview()}>Refresh</button> :
          <button type="button" disabled={["waiting", "saving", "refreshing"].includes(stage)} onClick={() => void adopt(stage === "error")}>{stage === "error" ? "Retry" : "Update"}</button>}
      </div>
    </dialog> : null,
  };
}

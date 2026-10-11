"use client";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import LibraryDialog from "@/components/library/LibraryDialog";
import { AssessmentConflict, sameAssessmentSource, type AssessmentCommand, type AssessmentList, type AssessmentMutationResult } from "@/lib/assessments/contracts";
import { discardFailedAssessment, persistAssessment, readPersonalAssessments, retryFailedAssessment } from "@/lib/assessments/client";
import type { HistoryResult } from "@/lib/assessments/history";
import { personalWork } from "@/lib/cards/personalWork";
import { getTodayDateOnly, dateOnlyToUtcDate, isIsoDateOnlyString } from "@/lib/dateOnly";
import type { AssessmentContext, useAssessmentHistory } from "./useAssessmentHistory";

type Draft = { action: "add" | "update" | "delete"; source: AssessmentCommand["source"]; id: string; revision: number; date: string; result: "" | "pass" | "fail"; cardIds: string[] };
type Pending = { command: AssessmentCommand; operation: Promise<AssessmentMutationResult>; canDiscard: boolean };
const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
function saveErrorMessage(cause: unknown) {
  const message = cause instanceof Error ? cause.message : "Unable to save assessment.";
  if (message === "WORKING_DECK_REQUIRED") return "Adding a test requires an active My Decks context. Your existing results are retained.";
  if (message === "ITEM_ASSESSMENT_CONTEXT_REQUIRED") return "This Item is no longer configured for new tests. Your existing results are retained.";
  if (message === "ASSESSMENT_SESSION_CONFLICT" || message === "UPDATE_SESSION_CONFLICT") return "Your sign-in session changed. Reopen this history after signing in.";
  if (/^[A-Z][A-Z0-9_]+$/.test(message)) return "Unable to save this assessment. Refresh the saved results before trying again.";
  return message;
}
export default function AssessmentModal({ context, history, onClose }: {
  context: AssessmentContext; history: ReturnType<typeof useAssessmentHistory>; onClose: () => void;
}) {
  const editorId = useId();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState<AssessmentList | null>(null);
  const [discard, setDiscard] = useState<"form" | "modal" | null>(null);
  const [retryable, setRetryable] = useState(false);
  const pending = useRef<Pending | null>(null);
  const busy = useRef(false);
  const editorFinish = useRef<(() => void) | null>(null);
  const mounted = useRef(true);
  const data = history.data?.history;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; editorFinish.current?.(); }; }, []);
  const reset = () => {
    if (pending.current?.canDiscard) discardFailedAssessment(pending.current.command, pending.current.operation);
    pending.current = null; setDraft(null); setError(""); setConflict(null); setRetryable(false); setDiscard(null);
    editorFinish.current?.(); editorFinish.current = null;
  };
  const close = (target: "form" | "modal") => {
    if (busy.current) return;
    if (pending.current && !pending.current.canDiscard) { setError("The save outcome is still uncertain. Retry to check the saved result before discarding."); return; }
    if (draft) setDiscard(target); else onClose();
  };
  const start = (row?: HistoryResult, remove = false) => {
    if (draft || saving) return;
    const source = row?.source ?? context.source;
    const revision = row?.sourceRevision ?? data?.sources.find((dependency) => sameAssessmentSource(dependency.source, source))?.revision;
    if (revision == null) { setError("This assessment source is unavailable. Refresh before editing."); return; }
    setError(""); setConflict(null);
    const cardIds = [...new Set([...(context.source.kind === "card" ? [context.source.cardTemplateId] : []),
      ...(source.kind === "card" ? [source.cardTemplateId] : []), ...(row?.exposedThroughCardTemplateIds ?? [])])];
    try { editorFinish.current = personalWork.begin({ userId: context.viewerUserId, cardIds }, `assessment-editor:${editorId}`); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Please wait for Update to finish."); return; }
    setDraft({ action: row ? remove ? "delete" : "update" : "add", source, revision, id: row?.id ?? crypto.randomUUID(),
      date: row?.date ?? getTodayDateOnly(), result: row ? row.result ? "pass" : "fail" : "",
      cardIds });
  };
  const finishSave = async (command: AssessmentCommand, operation: Promise<AssessmentMutationResult>) => {
    busy.current = true; setSaving(true); setError(""); setRetryable(false); setDiscard(null);
    pending.current = { command, operation, canDiscard: false };
    try {
      await operation;
      if (!mounted.current) return;
      pending.current = null; reset(); history.refresh();
    } catch (cause) {
      if (!mounted.current) return;
      // Refresh the original storage list, not a combined fork list. A confirmed
      // conflict is safe to abandon; uncertain failures keep their exact retry.
      let current: AssessmentList | null = cause instanceof AssessmentConflict ? cause.latestList : null;
      try { current = await readPersonalAssessments(context.viewerUserId, command.source); }
      catch { /* Preserve the error and intent; never pretend a failed read is empty. */ }
      if (!mounted.current) return;
      pending.current!.canDiscard = current !== null;
      if (cause instanceof AssessmentConflict || current && current.revision !== command.expectedRevision) {
        setConflict(current); setError("The saved assessments changed while you were editing. Review the current result before resubmitting.");
      } else { setError(saveErrorMessage(cause)); setRetryable(true); }
      history.refresh();
    } finally { busy.current = false; if (mounted.current) setSaving(false); }
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!draft || busy.current || retryable || history.error) return;
    if (draft.action !== "delete" && !draft.result) return;
    if (draft.action !== "delete" && !isIsoDateOnlyString(draft.date)) { setError("Enter a valid calendar date in YYYY-MM-DD format."); return; }
    const missing = conflict && !conflict.tests.some((test) => test.id === draft.id);
    if (missing && draft.action === "update") return;
    // A reviewed new addition gets a new identity; it never resurrects the ID
    // of an uncertain Add that might subsequently have been deleted elsewhere.
    const id = conflict && missing && draft.action === "add" ? crypto.randomUUID() : draft.id;
    const base = { viewerUserId: context.viewerUserId, source: draft.source, id, expectedRevision: conflict?.revision ?? draft.revision };
    const command: AssessmentCommand = draft.action === "delete" ? { ...base, action: "delete" }
      : { ...base, action: draft.action, date: draft.date, result: draft.result === "pass",
        ...(draft.action === "add" && draft.source.kind === "card" ? { deckTemplateId: context.deckTemplateId } : {}) };
    setConflict(null);
    try { void finishSave(command, persistAssessment(command, draft.cardIds)); }
    catch (cause) { setError(saveErrorMessage(cause)); }
  };
  const retry = () => {
    if (!pending.current || busy.current) return;
    const { command, operation } = pending.current;
    try { void finishSave(command, retryFailedAssessment(command, operation)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Refresh before retrying."); }
  };
  const current = draft && conflict?.tests.find((test) => test.id === draft.id);
  const canAdd = context.canCreate && (context.source.kind === "card" || history.data?.configured === true)
    && data?.sources.some((dependency) => sameAssessmentSource(dependency.source, context.source) && dependency.canMutate && dependency.revision !== null);
  return createPortal(<LibraryDialog title="Assessment history" onCancel={() => close("modal")} className="assessment-dialog" isolateInteractions>
    <div className="assessment-toolbar"><button type="button" onClick={() => start()} disabled={!canAdd || !!draft || saving || history.loading || !!history.error}>Add test</button>
      <button type="button" onClick={() => close("modal")} disabled={saving}>Close</button></div>
    {history.loading ? <p role="status">Loading assessments…</p> : null}
    {history.error ? <p role="alert">Assessment history could not be refreshed. {data ? "The results below may be out of date." : ""} <button type="button" onClick={history.refresh}>Refresh history</button></p> : null}
    {data?.state === "incomplete" ? <p className="assessment-notice" role="status">Some assessment history is unavailable. Readable results are shown below. {!history.error ? <button type="button" onClick={history.refresh}>Refresh history</button> : null}</p> : null}
    {!history.loading && !history.error && data?.state === "empty" ? <p>No tests recorded yet.</p> : null}
    {data?.results.length ? <div className="assessment-table-scroll"><table className="assessment-table"><caption className="sr-only">Assessments, newest first</caption>
      <thead><tr><th scope="col">Date</th><th scope="col">Result</th><th scope="col">Card</th><th scope="col">Actions</th></tr></thead>
      <tbody>{data.results.map((row) => <tr key={JSON.stringify([row.source, row.id])}>
        <td><time dateTime={row.date}>{dateFormat.format(dateOnlyToUtcDate(row.date))}</time></td>
        <td><span className={row.result ? "assessment-pass" : "assessment-fail"} aria-hidden="true">{row.result ? "✓" : "●"}</span><span className="sr-only">{row.result ? "Pass" : "Fail"}</span></td>
        <td className={row.relationship === "inherited-card" ? "assessment-source" : undefined}><span>{row.sourceTitle}</span>
          {row.relationship === "inherited-card" ? <small>Source Card</small> : null}</td>
        <td><div className="assessment-row-actions"><button type="button" aria-label={`Edit test ${row.date} from ${row.sourceTitle}`} disabled={!row.canMutate || !!draft || history.loading || !!history.error} onClick={() => start(row)}>Edit</button>
          <button type="button" aria-label={`Delete test ${row.date} from ${row.sourceTitle}`} disabled={!row.canMutate || !!draft || history.loading || !!history.error} onClick={() => start(row, true)}>Delete</button></div></td>
      </tr>)}</tbody></table></div> : null}
    {draft ? <form className="assessment-form" onSubmit={submit} aria-label={draft.action === "add" ? "Add assessment" : draft.action === "delete" ? "Delete assessment" : "Edit assessment"}>
      <h3>{draft.action === "add" ? "Add test" : draft.action === "delete" ? "Delete this test?" : "Edit test"}</h3>
      {draft.action !== "delete" ? <div className="assessment-fields"><label>Date<input autoFocus type="date" required value={draft.date} disabled={saving || retryable} onChange={(event) => setDraft({ ...draft, date: event.target.value })} /></label>
        <label>Result<select aria-label="Result" required value={draft.result} disabled={saving || retryable} onChange={(event) => setDraft({ ...draft, result: event.target.value as Draft["result"] })}><option value="">Choose result</option><option value="pass">Pass</option><option value="fail">Fail</option></select></label></div> : null}
      {conflict ? <p className="assessment-notice">{current ? `Currently saved: ${current.date}, ${current.result ? "Pass" : "Fail"}. Your entered values are retained.`
        : draft.action === "update" ? "This test was deleted elsewhere. It cannot be edited or recreated here." : draft.action === "delete" ? "This test has already been deleted." : "This result is not present. Saving your reviewed entry will record a new test."}</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      <div className="assessment-form-actions">{retryable ? <button type="button" onClick={retry} disabled={saving}>Check and retry save</button>
        : <button type="submit" disabled={saving || !!history.error || !!conflict && draft.action === "update" && !current}>{saving ? "Saving…" : conflict ? "Resubmit reviewed change" : draft.action === "delete" ? "Confirm delete" : "Save test"}</button>}
        <button type="button" onClick={() => close("form")} disabled={saving}>Cancel</button></div>
    </form> : error ? <p role="alert">{error}</p> : null}
    {discard ? <div className="assessment-notice" role="alert"><p>Discard your entered changes?</p><button type="button" onClick={() => { const target = discard; reset(); if (target === "modal") onClose(); }}>Discard changes</button><button type="button" onClick={() => setDiscard(null)}>Keep editing</button></div> : null}
  </LibraryDialog>, document.body);
}

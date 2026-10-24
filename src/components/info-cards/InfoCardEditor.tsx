"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import InfoCardFace from "./InfoCardFace";
import { InfoCardEditorController, type InfoEditorDTO, type SeriesOption } from "./infoCardEditorController";
import { actorCreatorTransport, CreatorActorLifetime, creatorRequest } from "../creator/creatorRequest";
import CreatorModeSelector from "../creator/CreatorModeSelector";
import CreatorVisibilityControl from "../creator/CreatorVisibilityControl";
import { measureInfoCapacity } from "@/lib/infoCards/capacity";
import InfoSeriesSelector from "./InfoSeriesSelector";
import LibraryDialog from "../library/LibraryDialog";
import { infoCardError } from "./infoCardErrors";
import CreatorDraftsModal from "../creator/CreatorDraftsModal";
import { loadCreatorDraftEntries, creatorDraftHref, type CreatorDraftEntry } from "../creator/creatorDraftEntries";
import styles from "./InfoCardEditor.module.css";
import { uploadInfoCardMedia } from "./infoCardUpload";
import { useInfoVideoStatus } from "./useInfoVideoStatus";
import InfoCardRemoteMediaViewer from "./InfoCardRemoteMediaViewer";
import type { InfoMedia, MediaContext } from "@/lib/infoCards/model";
import { currentDraftOrigin, infoCollectionTarget, infoEditorHref, type CreatorNavigation } from "../creator/creatorNavigation";
const subscribeHydration = () => () => {};

export default function InfoCardEditor({ id, actor, username, initial, navigation }: { id: string; actor: string; username: string; initial: InfoEditorDTO | null; navigation: CreatorNavigation }) {
  const router = useRouter();
  const hydrated = useSyncExternalStore(subscribeHydration, () => true, () => false);
  const [lifetime] = useState(() => new CreatorActorLifetime());
  const [controller] = useState(() => new InfoCardEditorController(id, actor, initial, actorCreatorTransport(actor, () => lifetime.isActive())));
  const [, redraw] = useState(0);
  const [message, setMessage] = useState("");
  const [navigating, setNavigating] = useState(false);
  const [sessionChanged, setSessionChanged] = useState(false);
  const [series, setSeries] = useState<SeriesOption | null>(initial?.selectedSeries ?? null);
  const [confirmPublic, setConfirmPublic] = useState(false);
  const [leaveDestination, setLeaveDestination] = useState<string | null>(null);
  const [showRequired, setShowRequired] = useState(false), [prerequisiteFeedback, setPrerequisiteFeedback] = useState(false);
  const [titlePrerequisiteFeedback, setTitlePrerequisiteFeedback] = useState(false);
  const [drafts, setDrafts] = useState<CreatorDraftEntry[] | null>(null);
  const [draftsLoading, setDraftsLoading] = useState(false), [draftsError, setDraftsError] = useState("");
  const draftsTrigger = useRef<HTMLButtonElement>(null);
  const publishTrigger = useRef<HTMLButtonElement>(null), libraryTrigger = useRef<HTMLButtonElement>(null);
  const upload = useRef<{ controller: AbortController; task: Promise<void> } | null>(null);
  const uploadFailure = useRef("");
  const [uploading, setUploading] = useState(false), [uploadError, setUploadError] = useState("");
  const [mediaPreview, setMediaPreview] = useState<{ media: InfoMedia; context: MediaContext } | null>(null);
  const videoStatus = useInfoVideoStatus(controller);
  const [mountLifetime] = useState(() => ({ epoch: 0 }));
  useEffect(() => {
    const epoch = ++mountLifetime.epoch;
    lifetime.setActive(true);
    const unsubscribe = controller.subscribe(() => {
      redraw(value => value + 1);
      const selected = controller.ack?.selectedSeries;
      if (selected?.seriesId === controller.desired.seriesId) setSeries(selected);
    });
    try { controller.configureRecovery(window.sessionStorage); } catch { controller.configureRecovery(); }
    void controller.flush().catch(() => {});
    return () => {
      controller.stopTimer(); unsubscribe();
      // Native browser Back may unmount before the debounce fires. Finish only
      // this actor-bound entity's save; never start a publication on navigation.
      const finish = !controller.error && controller.pendingPublication === undefined ? controller.flush() : Promise.resolve();
      void finish.catch(() => {}).finally(() => { if (mountLifetime.epoch === epoch) lifetime.setActive(false); });
    };
  }, [controller, lifetime, mountLifetime]);
  useEffect(() => {
    let live = true;
    const check = () => {
      void creatorRequest<{ user: { id: string } | null }>("/api/auth/me").then(value => {
        if (live && value.user?.id !== actor) { lifetime.setActive(false); controller.stopTimer(); upload.current?.controller.abort(); setSessionChanged(true); }
      }).catch(() => {});
    };
    window.addEventListener("focus", check); window.addEventListener("pageshow", check);
    return () => { live = false; window.removeEventListener("focus", check); window.removeEventListener("pageshow", check); };
  }, [actor, lifetime, controller]);
  useEffect(() => () => { upload.current?.controller.abort(); }, []);
  useEffect(() => {
    const href = controller.ack || controller.dirty ? infoEditorHref(id, !!controller.ack, navigation) : null;
    if (href && window.location.pathname + window.location.search !== href) window.history.replaceState(null, "", href);
  }, [controller, controller.ack, controller.dirty, id, navigation]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (controller.dirty || controller.running || controller.pendingPublication !== undefined) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [controller]);
  const content = controller.desired;
  const hasSelectedSeries = !!content.seriesId && series?.seriesId === content.seriesId;
  const capacity = measureInfoCapacity({ ...content, seriesTitle: series?.title ?? "", hasMedia: !!content.mediaItem });
  const titleCapacityIssue = hasSelectedSeries ? capacity.fieldIssues.find(issue => issue.field === "title") : undefined;
  const bodyCapacityIssue = capacity.fieldIssues.find(issue => issue.field === "body");
  const previewOverflow = capacity.fieldIssues.length > 0;
  const titleRequired = showRequired && !content.title.trim();
  const locked = !hydrated || navigating || confirmPublic || leaveDestination !== null || controller.publishing || controller.pendingPublication !== undefined;
  const ready = hasSelectedSeries && !!content.title.trim();
  const bodyRequired = showRequired && ready && !content.body.trim();
  const returnTarget = infoCollectionTarget(id, controller.confirmedPublicationVersion);
  async function navigate(href: string, collectionReturn = false, confirmed = false) {
    setNavigating(true); setMessage("");
    try {
      await upload.current?.task; if (uploadFailure.current) throw new Error("Upload incomplete"); await controller.flush();
      if (collectionReturn && !confirmed && controller.ack?.root.latestVersion === 0) { setNavigating(false); setLeaveDestination(href); return; }
      router.push(collectionReturn ? infoCollectionTarget(id, controller.confirmedPublicationVersion).href : href);
    }
    catch { setNavigating(false); setMessage("Current work could not be saved. Resolve the error before leaving."); }
  }
  async function publish() {
    setMessage("");
    setShowRequired(true);
    if (!ready || !content.body.trim()) return;
    if (uploading || uploadFailure.current) { setMessage("Finish, retry or cancel the upload before publishing."); return; }
    if (controller.visibility === "public" && controller.ack?.root.visibility !== "public") { setConfirmPublic(true); return; }
    await publishNow();
  }
  async function publishNow() {
    await controller.publish().then(() => { setSeries(controller.ack!.selectedSeries); setMessage("Published."); }).catch(() => {});
    requestAnimationFrame(() => (controller.error ? publishTrigger.current : libraryTrigger.current)?.focus({ preventScroll: true }));
  }
  function cancelPublicConfirmation() { setConfirmPublic(false); requestAnimationFrame(() => publishTrigger.current?.focus({ preventScroll: true })); }
  async function chooseMedia(file: File) {
    if (!ready) { setPrerequisiteFeedback(true); return; }
    upload.current?.controller.abort(); uploadFailure.current = ""; setUploadError(""); setUploading(true);
    const abort = new AbortController();
    const operation = { controller: abort, task: Promise.resolve() };
    upload.current = operation;
    operation.task = uploadInfoCardMedia(controller, file, abort.signal).then(() => {
      if (!abort.signal.aborted) setMessage("Media uploaded and saved.");
    }).catch(cause => {
      if (abort.signal.aborted || upload.current !== operation) return;
      uploadFailure.current = infoCardError(cause); setUploadError(uploadFailure.current);
    }).finally(() => { if (upload.current === operation) { upload.current = null; setUploading(false); } });
    await operation.task;
  }
  function cancelUpload(remove = false) {
    upload.current?.controller.abort(); upload.current = null; uploadFailure.current = "";
    setUploadError(""); setUploading(false);
    if (remove) controller.edit({ ...controller.desired, mediaItem: null });
  }
  async function openMedia() {
    try {
      await controller.flush(); const saved = controller.ack!;
      const media = saved.root.draft?.mediaItem ?? (saved.root.draft === null ? saved.publication?.content.mediaItem : null);
      if (media) setMediaPreview({ media, context: saved.root.draft ? { infoCardId: id, kind: "draft", revision: saved.root.revision }
        : { infoCardId: id, kind: "publication", version: saved.publication!.version } });
    } catch (cause) { setMessage(infoCardError(cause)); }
  }
  async function openDrafts() {
    setDrafts([]); setDraftsLoading(true); setDraftsError("");
    try { await controller.flush(); const result = await loadCreatorDraftEntries(controller.request); setDrafts(result.items); setDraftsError(result.error); }
    catch (cause) { setDraftsError(infoCardError(cause)); }
    finally { setDraftsLoading(false); }
  }
  useEffect(() => {
    if (!navigation.openDrafts) return;
    let active = true;
    void Promise.resolve().then(async () => {
      if (!active) return;
      setDrafts([]); setDraftsLoading(true); setDraftsError("");
      try {
        await controller.flush(); const result = await loadCreatorDraftEntries(controller.request);
        if (active) { setDrafts(result.items); setDraftsError(result.error); }
      } catch (cause) { if (active) setDraftsError(infoCardError(cause)); }
      finally { if (active) setDraftsLoading(false); }
    });
    return () => { active = false; };
  }, [navigation.openDrafts, controller]);
  function closeDrafts() { setDrafts(null); requestAnimationFrame(() => draftsTrigger.current?.focus()); }
  const error = controller.error ? infoCardError(controller.error, capacity.fieldIssues) : "";
  if (sessionChanged) return <main className={styles.editor}><p role="alert">Your account changed. Reload before continuing.</p><button type="button" onClick={() => router.refresh()}>Reload</button></main>;
  return <main className={styles.editor}>
    <header className={styles.header}>
      <div className={styles.heading}>
        {navigation.creating && <CreatorModeSelector mode="info-card" disabled={locked} onChange={() => void navigate("/creator/new")} />}
        <h1>{navigation.creating ? "New Info Card" : "Edit Info Card"}</h1>
        <span className={styles.saveStatus} role="status">{navigating ? "Finishing saves…" : controller.running ? "Saving…" : controller.dirty ? "Unsaved changes" : controller.ack ? "Saved" : ""}</span>
      </div>
      <div className={styles.actions}>
        <button type="button" ref={draftsTrigger} disabled={locked} onClick={() => void openDrafts()}>My Drafts</button>
        <CreatorVisibilityControl label="Info Card" value={controller.visibility} publishedPublic={controller.ack?.root.visibility === "public"} disabled={locked}
          onChange={value => controller.edit(content, value)} />
        <button type="button" ref={publishTrigger} disabled={locked || !controller.outstanding} onClick={() => void publish()}>
          {controller.publishing ? "Publishing…" : controller.ack?.publication && !controller.outstanding ? "Published" : "Publish"}</button>
        <button type="button" ref={libraryTrigger} disabled={locked} onClick={() => void navigate(returnTarget.href, true)}>{returnTarget.label}</button>
      </div>
    </header>
    {message && <p className={styles.message} role="status">{message}</p>}
    {error && <div role="alert" className={styles.message}><p>{error}</p>
      <button type="button" disabled={controller.publishing} onClick={() => void controller.retry().then(() => { if (controller.ack?.selectedSeries) setSeries(controller.ack.selectedSeries); }).catch(() => {})}>Retry</button>
      <button type="button" onClick={() => { if (window.confirm("Replace your local edits with the saved version? Copy any text you want to keep first.")) { controller.discardSubmittedRecovery(); window.location.reload(); } }}>Reload saved version</button></div>}
    <div className={styles.layout}>
      <fieldset className={styles.form} disabled={locked} style={{ border: 0, padding: 0 }}>
        <InfoSeriesSelector actor={actor} username={username} selected={series} request={controller.request} disabled={locked} invalid={showRequired && !content.seriesId}
          onSelect={selected => { setSeries(selected); controller.edit({ ...controller.desired, seriesId: selected.seriesId }); }} />
        <div><label>Title<input value={content.title} readOnly={!hasSelectedSeries} aria-disabled={!hasSelectedSeries || undefined}
          aria-invalid={titleRequired || !!titleCapacityIssue || undefined}
          aria-describedby={[!hasSelectedSeries && titlePrerequisiteFeedback && "info-title-prerequisite", titleRequired && "info-title-error", titleCapacityIssue && "info-title-capacity"].filter(Boolean).join(" ") || undefined}
          onFocus={() => { if (!hasSelectedSeries) setTitlePrerequisiteFeedback(true); }}
          onClick={() => { if (!hasSelectedSeries) setTitlePrerequisiteFeedback(true); }}
          onKeyDown={() => { if (!hasSelectedSeries) setTitlePrerequisiteFeedback(true); }}
          onChange={event => { if (hasSelectedSeries) controller.edit({ ...content, title: event.target.value }); else setTitlePrerequisiteFeedback(true); }} /></label>
          {!hasSelectedSeries && titlePrerequisiteFeedback && <p id="info-title-prerequisite" role="status">Choose or create a series first.</p>}
          {titleRequired && <p id="info-title-error" role="alert">Enter a title.</p>}
          {titleCapacityIssue && <p id="info-title-capacity" className={styles.fieldError} role="alert">{titleCapacityIssue.message}</p>}</div>
        <div><label>Explanation<textarea value={content.body} readOnly={!ready} aria-disabled={!ready || undefined}
          aria-invalid={bodyRequired || !!bodyCapacityIssue || undefined}
          aria-describedby={[!ready && prerequisiteFeedback && "info-prerequisite", bodyRequired && "info-body-error", bodyCapacityIssue && "info-body-capacity"].filter(Boolean).join(" ") || undefined}
          onFocus={() => { if (!ready) setPrerequisiteFeedback(true); }} onClick={() => { if (!ready) setPrerequisiteFeedback(true); }}
          onKeyDown={() => { if (!ready) setPrerequisiteFeedback(true); }}
          onChange={event => { if (ready) controller.edit({ ...content, body: event.target.value }); else setPrerequisiteFeedback(true); }} /></label>
          {bodyRequired && <p id="info-body-error" role="alert">Enter an explanation.</p>}
          {bodyCapacityIssue && <p id="info-body-capacity" className={styles.fieldError} role="alert">{bodyCapacityIssue.message}</p>}</div>
        {!ready && prerequisiteFeedback && <p id="info-prerequisite" role="status">Choose a series and enter a title first.</p>}
        <section className={styles.media} aria-label="Info Card media">
          {ready ? <label>Image/video (optional)<input type="file" aria-label="Upload Info Card media" accept="image/*,video/*" disabled={uploading}
            onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void chooseMedia(file); }} /></label> :
            <button type="button" aria-disabled="true" aria-describedby={prerequisiteFeedback ? "info-prerequisite" : undefined}
              onClick={() => setPrerequisiteFeedback(true)}>Image/video (optional)</button>}
          {content.mediaItem && <p>{content.mediaItem.mediaType === "image" ? "Image attached" : "Video attached"}</p>}
          {uploading && <p role="status">Uploading media… Text edits continue to save.</p>}
          {(uploading || uploadError) && <button type="button" onClick={() => cancelUpload()}>Cancel upload</button>}
          {content.mediaItem && <button type="button" onClick={() => cancelUpload(true)}>Remove media</button>}
          {uploadError && <p role="alert">{uploadError}</p>}
          {videoStatus.status && <p role="status">{videoStatus.status}</p>}{videoStatus.error && <p role="alert">{videoStatus.error}</p>}
        </section>
      </fieldset>
      <section className={styles.preview} aria-label="Info Card preview">
        {previewOverflow ? <p role="status">Preview unavailable.</p> :
          <div className={styles.face}><InfoCardFace card={{ title: content.title, body: content.body, seriesTitle: series?.title ?? "Series", seriesCreatorUsername: series?.creatorUsername ?? username, mediaKind: content.mediaItem?.mediaType }}
            onOpenMedia={content.mediaItem && !uploading ? () => void openMedia() : undefined} /></div>}
      </section>
    </div>
    {leaveDestination && <LibraryDialog title="Leave Info Card Creator?" isolateInteractions onCancel={() => { setLeaveDestination(null); requestAnimationFrame(() => libraryTrigger.current?.focus()); }}>
      <p>This Info Card is saved in My Drafts and will not appear in Library until published.</p>
      <button type="button" onClick={() => { setLeaveDestination(null); requestAnimationFrame(() => libraryTrigger.current?.focus()); }}>Stay in Creator</button>
      <button type="button" onClick={() => { const href = leaveDestination; setLeaveDestination(null); void navigate(href, true, true); }}>Leave without publishing</button>
    </LibraryDialog>}
    {confirmPublic && <LibraryDialog title="Publish Info Card publicly?" isolateInteractions onCancel={cancelPublicConfirmation}>
      <p>Public content is available to other users and cannot be made private again.</p>
      <button type="button" onClick={cancelPublicConfirmation}>Cancel</button>
      <button type="button" onClick={() => { setConfirmPublic(false); void publishNow(); }}>Publish publicly</button>
    </LibraryDialog>}
    {drafts && <CreatorDraftsModal drafts={drafts} currentDeckTemplateId="" currentInfoCardId={id} loading={draftsLoading} error={draftsError}
      switchingTo={navigating ? "pending" : null} onClose={closeDrafts}
      onSelect={(selected, kind) => { if (kind === "infoCard" && selected === id) closeDrafts(); else void navigate(creatorDraftHref(selected, kind, currentDraftOrigin(window.location))); }} />}
    {mediaPreview && <InfoCardRemoteMediaViewer actor={actor} {...mediaPreview} onClose={() => setMediaPreview(null)} />}
  </main>;
}

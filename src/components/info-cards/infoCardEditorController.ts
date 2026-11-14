import type { InfoRenderingDiagnostic } from "@/lib/infoCards/mathsValidation";
import type { Visibility } from "@/lib/cards/model";
import { sameContent } from "@/lib/cards/publicationRules";
import { EMPTY_INFO_DRAFT, isNoteInfo, type InfoConsultationSnapshot, type PendingPublicationReceipt, type PersonalInfoContext, type PersonalInfoAssociation, type PublicationRequestState, type InfoDraft, type InfoPublication, type InfoRoot } from "@/lib/infoCards/model";
import { CreatorRequestError, type CreatorTransport } from "../creator/creatorRequest";
import type { CreationContext } from "@/lib/groupExperiences/media/contributionIdentity";

export type SeriesOption = { seriesId: string; title: string; createdByUserId: string; creatorUsername: string };
export type InfoEditorDTO = { root: InfoRoot; publication: InfoPublication | null; selectedSeries: SeriesOption | null };
type SaveCommand = { revision: number; content: InfoDraft; visibility: Visibility; mediaProof?: string };
type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem"> & Partial<Pick<globalThis.Storage, "key" | "length">>;
// A note is created either on the standalone Card (`context`, attached to CardData) or in Me in a Group (`group`,
// a Follower contribution that never touches CardData). Both are saved through the same Save and pending path.
// `group` creates a Group contribution in the perspective it is opened from: "self" in Me (checkpoint 4.2),
// "group" in the Group perspective (an Admin contribution, checkpoint 4.4). Used only when creating.
export type PersonalEditorContext = { originCardTemplateId: string; context?: PersonalInfoContext;
  group?: { experienceId: string; accessEpoch: number; version: number; creationContext: CreationContext } };
export type SettledPublication = PublicationRequestState & { association?: PersonalInfoAssociation };
type Recovery = { actor: string; id: string; save?: SaveCommand; publish?: number; personal?: PersonalEditorContext };
const clone = <T>(value: T): T => structuredClone(value);
const uncertain = (error: unknown) => !(error instanceof CreatorRequestError) || (error.status >= 500 || error.status === 408) && error.details?.publicationNotCommitted !== true;
const correctable = (error: unknown) => error instanceof CreatorRequestError && [400, 403, 422].includes(error.status)
  && !error.code.includes("SESSION") && error.code !== "INFO_FORBIDDEN";

// One authoring entity, serial writes, no deck/progress/adoption state.
export class InfoCardEditorController {
  desired: InfoDraft;
  visibility: Visibility;
  ack: InfoEditorDTO | null;
  error: unknown = null;
  private errorOperation: "save" | "publish" | null = null;
  running: Promise<void> | null = null;
  publishing = false;
  checkingRendering = false;
  renderingCheckError: unknown = null;
  private renderingResult: InfoRenderingDiagnostic | null = null;
  private renderingGeneration = 0;
  get renderingCheck() { return !this.dirty && this.renderingResult?.revision === this.ack?.root.revision ? this.renderingResult : null; }
  pendingPublication: number | undefined;
  confirmedPublicationVersion: number | null = null;
  personalAssociation?: PersonalInfoAssociation;
  private pendingSave: SaveCommand | undefined;
  private mediaProof: string | undefined;
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private storage?: Storage;
  private recoveryError = false;
  private recoveringSelection = false;
  readonly personal?: PersonalEditorContext;
  constructor(readonly id: string, readonly actor: string, initial: InfoEditorDTO | null, readonly request: CreatorTransport, readonly newMaths = false, personal?: PersonalEditorContext) {
    // Keep command identity serialisable. The editor's embedding props also
    // contain callbacks/DOM refs, which must never enter the recovery journal.
    this.personal = personal ? { originCardTemplateId: personal.originCardTemplateId,
      ...(personal.context ? { context: { deckTemplateId: personal.context.deckTemplateId, version: personal.context.version,
        personalInfoRevision: personal.context.personalInfoRevision } } : {}),
      ...(personal.group ? { group: { experienceId: personal.group.experienceId, accessEpoch: personal.group.accessEpoch, version: personal.group.version,
        creationContext: personal.group.creationContext } } : {}) }
      : initial && isNoteInfo(initial.root) ? { originCardTemplateId: initial.root.originCardTemplateId! } : undefined;
    this.ack = initial;
    this.desired = clone(initial?.root.draft ?? initial?.publication?.content ?? EMPTY_INFO_DRAFT);
    this.visibility = initial?.root.draftVisibility ?? "private";
  }
  get url() { return `/api/info-cards/${encodeURIComponent(this.id)}`; }
  get dirty() { return !sameContent(this.desired, this.ack?.root.draft ?? this.ack?.publication?.content ?? EMPTY_INFO_DRAFT)
    || this.visibility !== (this.ack?.root.draftVisibility ?? "private"); }
  // A Publish or Save the server accepted while the video was still processing (checkpoint 10). Read from the
  // acknowledged root, the single source of truth; any newer draft save clears it on the server.
  get requestedPublication(): "pending" | { code: string } | null {
    const root = this.ack?.root;
    if (!root) return null;
    if (root.pendingPublication?.revision === root.revision) return "pending";
    return root.lastPublicationFailure?.revision === root.revision ? { code: root.lastPublicationFailure.code } : null;
  }
  get outstanding() { return !this.ack?.publication || !sameContent(this.desired, this.ack.publication.content) || this.visibility !== this.ack.root.visibility; }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private changed() { for (const listener of this.listeners) listener(); }
  private get key() { return `switchplay:info-submitted:v1:${this.actor}:${this.id}`; }
  configureRecovery(storage?: Storage) {
    this.storage = storage;
    try {
      if (!storage) throw new Error("Session storage unavailable");
      if (typeof storage.key === "function" && typeof storage.length === "number") {
        for (let index = storage.length - 1; index >= 0; index--) {
          const key = storage.key(index);
          if (key?.startsWith("switchplay:info-submitted:v1:") && !key.startsWith(`switchplay:info-submitted:v1:${this.actor}:`)) storage.removeItem(key);
        }
      }
      const raw = storage.getItem(this.key);
      if (!raw) return;
      const record = JSON.parse(raw) as Recovery;
      if (record.actor !== this.actor || record.id !== this.id || (!record.save && record.publish === undefined)) throw new Error("Invalid recovery record");
      if (!!record.personal !== !!this.personal || record.personal?.originCardTemplateId !== this.personal?.originCardTemplateId) throw new Error("Invalid recovery purpose");
      this.pendingSave = record.save; this.pendingPublication = record.publish;
      if (record.save) { this.desired = clone(record.save.content); this.visibility = record.save.visibility; this.mediaProof = record.save.mediaProof; this.recoveringSelection = true; }
      if (record.publish !== undefined) { this.errorOperation = "publish"; this.error = new CreatorRequestError(503, "INFO_PUBLICATION_RECOVERY_REQUIRED"); }
      this.changed();
    } catch { this.recoveryError = true; this.error = new CreatorRequestError(409, "INFO_RECOVERY_UNAVAILABLE"); this.changed(); }
  }
  discardSubmittedRecovery() { this.storage?.removeItem(this.key); }
  private journal() {
    if (!this.storage) return;
    // Submitted immutable commands only; never File/provider upload URL/session credentials.
    if (this.pendingSave || this.pendingPublication !== undefined) this.storage.setItem(this.key, JSON.stringify({ actor: this.actor, id: this.id,
      save: this.pendingSave, publish: this.pendingPublication, ...(this.personal ? { personal: this.personal } : {}) } satisfies Recovery));
    else this.storage.removeItem(this.key);
  }
  edit(content: InfoDraft, visibility = this.visibility, proof = this.mediaProof) {
    if (this.personal) visibility = "private";
    if (this.newMaths && !this.ack) content = { ...content, bodyFormat: "latex-v1" };
    if (this.publishing || this.pendingPublication !== undefined || this.recoveryError) return;
    if (this.errorOperation === "publish" || this.errorOperation === "save" && correctable(this.error)) { this.error = null; this.errorOperation = null; }
    this.renderingGeneration++; this.renderingResult = null; this.renderingCheckError = null;
    this.desired = clone(content); this.visibility = visibility; this.mediaProof = proof;
    this.changed();
    clearTimeout(this.timer);
    if (!this.error) this.timer = setTimeout(() => { void this.flush().catch(() => {}); }, 250);
  }
  stopTimer() { clearTimeout(this.timer); }
  async ensureCreated() {
    if (this.ack) return;
    const group = this.personal?.group;
    const root = await this.request<InfoRoot>(group
      ? `/api/group-experiences/${encodeURIComponent(group.experienceId)}/cards/${encodeURIComponent(this.personal!.originCardTemplateId)}/info-cards`
      : this.personal ? `/api/cards-data/${encodeURIComponent(this.personal.originCardTemplateId)}/personal-info-cards` : "/api/info-cards", "POST", group
      ? { infoCardId: this.id, accessEpoch: group.accessEpoch, version: group.version, creationContext: group.creationContext }
      : { infoCardId: this.id, ...(this.personal ? { context: this.personal.context } : {}) });
    this.ack = { root, publication: null, selectedSeries: null }; this.changed();
  }
  async flush(): Promise<void> {
    clearTimeout(this.timer);
    if (this.error) throw this.error;
    if (this.pendingPublication !== undefined) throw new CreatorRequestError(409, "INFO_PUBLICATION_RECOVERY_REQUIRED");
    if (this.running) { await this.running; if (this.dirty) return this.flush(); return; }
    if (!this.dirty && !this.pendingSave) return;
    this.running = this.drain(); this.changed();
    try { await this.running; this.errorOperation = null; }
    catch (error) { this.error = error; this.errorOperation = "save"; throw error; }
    finally { this.running = null; this.changed(); }
  }
  private async drain() {
    if (!this.ack) {
      // Persist the submitted first save before creation. A lost create response
      // followed by reload must not strand the text in an otherwise empty root.
      this.pendingSave ??= { revision: 0, content: clone(this.desired), visibility: this.visibility, ...(this.mediaProof ? { mediaProof: this.mediaProof } : {}) };
      this.journal();
    }
    await this.ensureCreated();
    while (this.dirty || this.pendingSave) {
      this.pendingSave ??= { revision: this.ack!.root.revision, content: clone(this.desired), visibility: this.visibility,
        ...(this.mediaProof ? { mediaProof: this.mediaProof } : {}) };
      this.journal();
      const command = this.pendingSave;
      let root: InfoRoot;
      try { root = await this.request<InfoRoot>(this.url, "PATCH", command); }
      catch (error) { if (correctable(error)) { this.pendingSave = undefined; this.journal(); } throw error; }
      this.ack = { ...this.ack!, root };
      this.pendingSave = undefined; this.journal(); this.changed();
    }
    if (this.recoveringSelection) {
      const remote = await this.request<InfoEditorDTO>(this.url);
      if (remote.selectedSeries?.seriesId === this.desired.seriesId) this.ack = { ...this.ack!, selectedSeries: remote.selectedSeries };
      this.recoveringSelection = false; this.changed();
    }
  }
  async retry() {
    if (this.recoveryError) throw this.error;
    if (this.personal?.context && this.error instanceof CreatorRequestError && this.error.code === "STALE_PERSONAL_INFO_REVISION") {
      // Another note changed this list, not this draft. Reuse the authorised
      // exact-main snapshot to refresh only the first-attachment CAS context.
      const context = this.personal.context;
      try {
        const snapshot = await this.request<InfoConsultationSnapshot>(`/api/card-templates/${encodeURIComponent(this.personal.originCardTemplateId)}/info-cards?${new URLSearchParams({ mode: "working", version: String(context.version), deckTemplateId: context.deckTemplateId })}`);
        const source = snapshot.personalSources?.find(source => source.cardTemplateId === this.personal!.originCardTemplateId);
        if (snapshot.mainCardId !== this.personal.originCardTemplateId || snapshot.mainCardVersion !== context.version
          || !source || !Number.isSafeInteger(source.personalInfoRevision) || source.personalInfoRevision < 0) throw new CreatorRequestError(409, "PERSONAL_INFO_CONTEXT_REQUIRED");
        context.personalInfoRevision = source.personalInfoRevision;
      } catch (error) { this.error = error; this.changed(); throw error; }
    }
    const operation = this.errorOperation;
    this.error = null; this.changed();
    if (this.pendingPublication !== undefined || operation === "publish") return this.publish();
    return this.flush();
  }
  async checkRendering() {
    if (this.checkingRendering || this.publishing || this.pendingPublication !== undefined) return;
    this.checkingRendering = true; this.renderingResult = null; this.renderingCheckError = null; this.changed();
    let generation = this.renderingGeneration;
    try {
      await this.flush(); await this.ensureCreated();
      generation = this.renderingGeneration;
      const revision = this.ack!.root.revision;
      const result = await this.request<InfoRenderingDiagnostic>(`${this.url}/check-rendering`, "POST", { revision });
      if (generation === this.renderingGeneration && !this.dirty && this.ack?.root.revision === revision && result.revision === revision) this.renderingResult = result;
    } catch (error) {
      if (generation === this.renderingGeneration) this.renderingCheckError = error;
    } finally { this.checkingRendering = false; this.changed(); }
  }
  async publish(): Promise<"published" | "pending" | undefined> {
    if (this.publishing) return;
    this.publishing = true; this.error = null; this.changed();
    try {
      if (this.pendingPublication === undefined) { await this.flush(); await this.ensureCreated(); }
      this.pendingPublication ??= this.ack!.root.revision; this.journal();
      const receipt = await this.request<(InfoPublication | PendingPublicationReceipt) & { association?: PersonalInfoAssociation }>(`${this.url}/${this.personal ? "save" : "publish"}`, "POST", {
        revision: this.pendingPublication, ...(this.personal?.context ? { context: this.personal.context } : {}) });
      // Receipt retry is safe even if another tab has made newer edits. Always
      // read the editor separately instead of synthesising current state from it.
      const remote = await this.request<InfoEditorDTO>(this.url);
      this.ack = remote; this.desired = clone(remote.root.draft ?? remote.publication!.content); this.visibility = remote.root.draftVisibility;
      if ("status" in receipt) {
        // Stored on the server: nothing is left to recover locally, and leaving the editor no longer loses it.
        this.pendingPublication = undefined; this.errorOperation = null; this.journal(); return "pending";
      }
      this.confirmedPublicationVersion = receipt.version;
      this.personalAssociation = receipt.association;
      this.pendingPublication = undefined; this.errorOperation = null; this.journal();
      return "published";
    } catch (error) {
      if (!uncertain(error)) { this.pendingPublication = undefined; this.journal(); }
      this.error = error; if (this.errorOperation !== "save") this.errorOperation = "publish"; throw error;
    } finally { this.publishing = false; this.changed(); }
  }
  // The status poll reports what happened to a stored request. Re-read the editor rather than patching state.
  async settlePublication(state: SettledPublication) {
    if (state.status === "pending" || this.dirty || this.running || this.publishing) return;
    const remote = await this.request<InfoEditorDTO>(this.url);
    if (this.dirty || this.running || this.publishing) return;
    this.ack = remote; this.desired = clone(remote.root.draft ?? remote.publication?.content ?? EMPTY_INFO_DRAFT); this.visibility = remote.root.draftVisibility;
    if (state.status === "published") { this.confirmedPublicationVersion = state.version; this.personalAssociation = state.association; }
    // A processing failure is shown by the media area with its own replacement path; anything else is an error
    // that Retry answers by pressing Publish or Save again.
    else if (state.code !== "INFO_MEDIA_PROCESSING_FAILED") { this.error = new CreatorRequestError(422, state.code); this.errorOperation = "publish"; }
    this.changed();
  }
}

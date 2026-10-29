import type { InfoRenderingDiagnostic } from "@/lib/infoCards/mathsValidation";
import type { Visibility } from "@/lib/cards/model";
import { sameContent } from "@/lib/cards/publicationRules";
import { EMPTY_INFO_DRAFT, type InfoDraft, type InfoPublication, type InfoRoot } from "@/lib/infoCards/model";
import { CreatorRequestError, type CreatorTransport } from "../creator/creatorRequest";

export type SeriesOption = { seriesId: string; title: string; createdByUserId: string; creatorUsername: string };
export type InfoEditorDTO = { root: InfoRoot; publication: InfoPublication | null; selectedSeries: SeriesOption | null };
type SaveCommand = { revision: number; content: InfoDraft; visibility: Visibility; mediaProof?: string };
type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem"> & Partial<Pick<globalThis.Storage, "key" | "length">>;
type Recovery = { actor: string; id: string; save?: SaveCommand; publish?: number };
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
  private pendingSave: SaveCommand | undefined;
  private mediaProof: string | undefined;
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private storage?: Storage;
  private recoveryError = false;
  private recoveringSelection = false;
  constructor(readonly id: string, readonly actor: string, initial: InfoEditorDTO | null, readonly request: CreatorTransport, readonly newMaths = false) {
    this.ack = initial;
    this.desired = clone(initial?.root.draft ?? initial?.publication?.content ?? EMPTY_INFO_DRAFT);
    this.visibility = initial?.root.draftVisibility ?? "private";
  }
  get url() { return `/api/info-cards/${encodeURIComponent(this.id)}`; }
  get dirty() { return !sameContent(this.desired, this.ack?.root.draft ?? this.ack?.publication?.content ?? EMPTY_INFO_DRAFT)
    || this.visibility !== (this.ack?.root.draftVisibility ?? "private"); }
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
      save: this.pendingSave, publish: this.pendingPublication } satisfies Recovery));
    else this.storage.removeItem(this.key);
  }
  edit(content: InfoDraft, visibility = this.visibility, proof = this.mediaProof) {
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
    const root = await this.request<InfoRoot>("/api/info-cards", "POST", { infoCardId: this.id });
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
  async publish() {
    if (this.publishing) return;
    this.publishing = true; this.error = null; this.changed();
    try {
      if (this.pendingPublication === undefined) { await this.flush(); await this.ensureCreated(); }
      this.pendingPublication ??= this.ack!.root.revision; this.journal();
      const receipt = await this.request<InfoPublication>(`${this.url}/publish`, "POST", { revision: this.pendingPublication });
      // Receipt retry is safe even if another tab has made newer edits. Always
      // read the editor separately instead of synthesising current state from it.
      const remote = await this.request<InfoEditorDTO>(this.url);
      this.ack = remote; this.desired = clone(remote.root.draft ?? remote.publication!.content); this.visibility = remote.root.draftVisibility;
      this.confirmedPublicationVersion = receipt.version;
      this.pendingPublication = undefined; this.errorOperation = null; this.journal();
    } catch (error) {
      if (!uncertain(error)) { this.pendingPublication = undefined; this.journal(); }
      this.error = error; if (this.errorOperation !== "save") this.errorOperation = "publish"; throw error;
    } finally { this.publishing = false; this.changed(); }
  }
}

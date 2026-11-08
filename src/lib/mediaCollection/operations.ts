import { clientId } from "../clientId";
import { UserCardMediaMutationQueue } from "../userCardMediaMutationQueue";
import { uploadFileToR2, uploadFileToCloudflareStream, validateImageUploadFile, validateVideoUploadFile } from "../mediaUploadClient";
import { collectionKey, type MediaCollectionContext, type MediaCollectionItem } from "./contracts";
import { mediaJson } from "./transport";
import { notifyMediaCollectionChanged } from "./invalidation";
const queue = new UserCardMediaMutationQueue();
export function mutateCollectionItem(context: MediaCollectionContext, item: MediaCollectionItem, action: "delete" | "hide") {
  return queue.enqueue({ userId: context.viewerUserId, cardId: collectionKey(item), deckTemplateId: "media-collection" }, async () => {
    const source = item.source;
    if (action === "delete" && context.viewerUserId !== item.authorUserId) throw Error("Only the creator can delete this contribution.");
    if (action === "delete" && context.experienceId && (source.kind !== "group" || source.experienceId !== context.experienceId)) throw Error("Remove this upload in its original context or your Personal Card.");
    if (action === "delete" && context.experienceId && !Number.isSafeInteger(context.accessEpoch)) throw Error("Group authority changed. Reopen Media Centre.");
    let result;
    if (action === "hide") {
      if (context.kind !== "group" || source.kind !== "group" || source.experienceId !== context.experienceId) throw Error("Invalid Group hiding source.");
      result = await mediaJson(context, `/api/group-experiences/${encodeURIComponent(context.experienceId)}/media/${encodeURIComponent(source.contributionId)}`, "PATCH", { expectedRevision: item.revision, accessEpoch: context.accessEpoch });
    } else if (source.kind === "group") result = context.experienceId
      ? await mediaJson(context, `/api/group-experiences/${encodeURIComponent(context.experienceId)}/media/${encodeURIComponent(source.contributionId)}`, "DELETE", { expectedRevision: item.revision, accessEpoch: context.accessEpoch })
      : await mediaJson(context, `/api/group-media/${encodeURIComponent(source.contributionId)}`, "DELETE", { expectedRevision: item.revision });
    else result = await mediaJson(context, `/api/cards-data/${encodeURIComponent(source.cardTemplateId)}/media/${encodeURIComponent(source.mediaItemId)}`, "DELETE");
    notifyMediaCollectionChanged(item.authorUserId, context.cardTemplateId, source.kind === "group" ? source.experienceId : undefined, { source, action });
    return result;
  });
}
export type GroupUploadContext = { viewerUserId: string; experienceId: string; cardTemplateId: string; accessEpoch: number; version: number };
type Allocation = { contributionId: string; revision: number; proof: string; state: string; uploadURL?: string; headers?: Record<string, string> };
// A captured upload operation survives retry without borrowing the currently
// displayed perspective. No Personal upload fallback exists.
export class GroupMediaUpload {
  readonly context: GroupUploadContext; readonly operationId: string;
  private transferred = false; private transferAttempted = false; private uncertainId?: string; private allocation?: Allocation; private running = false;
  constructor(context: GroupUploadContext, readonly file: File, operationId = clientId()) { this.context = { ...context }; this.operationId = operationId; }
  async run(signal: AbortSignal) {
    if (this.running) throw Error("This upload is already running.");
    const kind = this.file.type.startsWith("image/") ? "image" : "video";
    const invalid = kind === "image" ? validateImageUploadFile(this.file) : validateVideoUploadFile(this.file);
    if (invalid) throw Error(invalid); this.running = true;
    const { context: c } = this;
    const path = `/api/group-experiences/${encodeURIComponent(c.experienceId)}/cards/${encodeURIComponent(c.cardTemplateId)}/media`;
    try {
      // An exact retry recovers a receipt/refreshes its proof, never another file.
      this.allocation = await mediaJson<Allocation>(c, path, "POST", { operationId: this.operationId, accessEpoch: c.accessEpoch, version: c.version, kind, contentType: this.file.type, size: this.file.size, ...(this.file.name ? { originalFilename: this.file.name } : {}) }, signal);
      if (this.allocation.state !== "attached" && !this.transferAttempted) {
        if (!this.allocation.uploadURL) throw Error("Upload allocation is unavailable.");
        this.transferAttempted = true;
        if (kind === "image") await uploadFileToR2(this.allocation.uploadURL, this.file, signal, this.allocation.headers);
        else await uploadFileToCloudflareStream(this.allocation.uploadURL, this.file, signal);
        this.transferred = true;
      }
      if (this.allocation.state !== "attached" && (kind === "video" || !this.transferred)) {
        let ready = false;
        for (let check = 0; check < 40; check++) {
          const status = await mediaJson<{ status: string }>(c, `/api/group-media/${encodeURIComponent(this.allocation.contributionId)}?action=status`, "GET", undefined, signal);
          if (status.status === "ready") { ready = true; break; }
          if (status.status === "failed") throw Error("Video processing failed.");
          await new Promise<void>((resolve, reject) => {
            if (signal.aborted) { reject(new DOMException("Upload cancelled.", "AbortError")); return; }
            const abort = () => { clearTimeout(timer); reject(new DOMException("Upload cancelled.", "AbortError")); };
            const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, 3000);
            signal.addEventListener("abort", abort, { once: true });
          });
        }
        if (!ready) throw Error("Media is still processing. Retry this upload operation shortly.");
      }
      if (signal.aborted) throw new DOMException("Upload cancelled.", "AbortError");
      const result = await mediaJson(c, `${path}/${encodeURIComponent(this.allocation.contributionId)}/commit`, "POST", { expectedRevision: this.allocation.revision, proof: this.allocation.proof }, signal);
      notifyMediaCollectionChanged(c.viewerUserId, c.cardTemplateId, c.experienceId); return result;
    } catch (error) {
      if (error && typeof error === "object" && "contributionId" in error && typeof error.contributionId === "string") this.uncertainId = error.contributionId;
      throw error;
    } finally { this.running = false; }
  }
  get contributionId() { return this.allocation?.contributionId ?? this.uncertainId; }
  async cancel(signal?: AbortSignal) {
    const id = this.contributionId; if (!id) return;
    const status = await mediaJson<{ revision: number }>(this.context, `/api/group-media/${encodeURIComponent(id)}?action=status`, "GET", undefined, signal);
    const result = await mediaJson(this.context, `/api/group-media/${encodeURIComponent(id)}`, "DELETE", { expectedRevision: status.revision }, signal);
    notifyMediaCollectionChanged(this.context.viewerUserId, this.context.cardTemplateId, this.context.experienceId); return result;
  }

}

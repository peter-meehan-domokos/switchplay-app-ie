import { invalidateMediaPreviews } from "./controller";
import type { MediaSource } from "./contracts";
export const MEDIA_COLLECTION_CHANGED = "switchplay:media-collection-changed";
export function notifyMediaCollectionChanged(viewerUserId: string, cardTemplateId: string, experienceId?: string, removed?: { source: MediaSource; action: "delete" | "hide" }) {
  invalidateMediaPreviews(viewerUserId, cardTemplateId, experienceId, removed);
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(MEDIA_COLLECTION_CHANGED, { detail: { viewerUserId, cardTemplateId, experienceId, removed } }));
}

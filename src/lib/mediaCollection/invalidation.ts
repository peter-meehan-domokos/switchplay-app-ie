export const MEDIA_COLLECTION_CHANGED = "switchplay:media-collection-changed";
export function notifyMediaCollectionChanged(viewerUserId: string, cardTemplateId: string, experienceId?: string) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(MEDIA_COLLECTION_CHANGED, { detail: { viewerUserId, cardTemplateId, experienceId } }));
}

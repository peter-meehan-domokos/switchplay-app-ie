import { getInteractiveVisual } from "@/lib/interactiveVisuals/catalogue";
import { MAX_STEP_MEDIA, validStepMediaItems, withStepMedia, type StepMediaDestination, type StepMediaItem } from "@/lib/stepMedia";
import type { ImageMediaItem, VideoMediaItem } from "@/lib/media";

export const defaultStepMediaLabel = (kind: StepMediaItem["kind"]) => kind === "video" ? "Watch" : kind === "image" ? "Image" : "Explore";
export function withCreatorStepMedia<T extends StepMediaDestination>(destination: T, items: StepMediaItem[], multimediaEnabled: boolean) {
  if (multimediaEnabled) return withStepMedia(destination, items);
  if (destination.mediaItems !== undefined || items.length > 1 || items.some(item => item.kind !== "video")) throw new Error("Multimedia editing is unavailable. Your existing media is kept.");
  return { ...destination, mediaItem: items[0]?.kind === "video" ? items[0].media : null };
}
export function putStepMedia(items: readonly StepMediaItem[], item: StepMediaItem, replacementId?: string): StepMediaItem[] {
  if (replacementId !== undefined && !items.some(existing => existing.id === replacementId)) throw new Error("The media being replaced has changed. Reopen the media manager.");
  if (replacementId === undefined && items.length >= MAX_STEP_MEDIA) throw new Error("Each introduction or step supports up to four media items.");
  const next = replacementId === undefined ? [...items, item] : items.map(existing => existing.id === replacementId ? item : existing);
  if (!validStepMediaItems(next)) throw new Error("Use short, single-line labels, up to 12 characters each and 32 altogether.");
  return next;
}
export function uploadedStepMedia(media: ImageMediaItem | VideoMediaItem, id: string, previous?: StepMediaItem): StepMediaItem {
  const label = previous?.label ?? defaultStepMediaLabel(media.mediaType);
  return media.mediaType === "video" ? { id, label, kind: "video", media }
    : { id, label, kind: "image", media, alt: previous?.kind === "image" ? previous.alt : media.description };
}
export function selectedStepVisual(activityId: string, id: string, previous?: StepMediaItem): StepMediaItem {
  if (getInteractiveVisual(activityId)?.status !== "published") throw new Error("Choose a published Interactive Visual.");
  return { id, kind: "activity", activityId, label: previous?.label ?? "Explore" };
}

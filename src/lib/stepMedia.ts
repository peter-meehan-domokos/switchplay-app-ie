import { isImageMediaItem, isVideoMediaItem, type ImageMediaItem, type MediaItem, type VideoMediaItem } from "./media";
import { getInteractiveVisual } from "./interactiveVisuals/catalogue";

export const STEP_MEDIA_PROTOCOL = "1";
export const MAX_STEP_MEDIA = 4;
type Attachment = { id: string; label: string };
export type StepMediaItem = Attachment & (
  | { kind: "video"; media: VideoMediaItem }
  | { kind: "image"; media: ImageMediaItem; alt: string }
  | { kind: "activity"; activityId: string }
);
export type StepMediaDestination = { mediaItem?: MediaItem | null; mediaItems?: StepMediaItem[] };
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const identifier = (value: unknown): value is string => typeof value === "string" && value.trim() === value && value.length > 0 && value.length <= 200;
const graphemes = (value: string) => Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(value)).length;
export function validStepMediaLabel(value: unknown): value is string {
  return typeof value === "string" && value.trim() === value && value.length > 0 && value.length <= 96
    && !/[\p{Cc}\p{Zl}\p{Zp}]/u.test(value) && graphemes(value) <= 12;
}
/** Structural bounds only. The creator measures actual combined tab widths at 320 CSS px. */
export function validStepMediaLabels(labels: readonly string[]): boolean {
  return labels.length <= MAX_STEP_MEDIA && labels.every(validStepMediaLabel) && labels.reduce((sum, label) => sum + graphemes(label), 0) <= 32;
}
export function validStepMediaItems(value: unknown): value is StepMediaItem[] {
  if (!Array.isArray(value) || value.length > MAX_STEP_MEDIA) return false;
  if (!value.every((item) => record(item) && identifier(item.id) && validStepMediaLabel(item.label))) return false;
  if (new Set(value.map((item) => item.id)).size !== value.length || !validStepMediaLabels(value.map(item => item.label))) return false;
  return value.every((item) => {
    const fields = item.kind === "activity" ? ["id", "label", "kind", "activityId"]
      : item.kind === "image" ? ["id", "label", "kind", "media", "alt"] : ["id", "label", "kind", "media"];
    if (Object.keys(item).some((key) => !fields.includes(key))) return false;
    if (item.kind === "activity") return identifier(item.activityId) && !!getInteractiveVisual(item.activityId);
    if (item.kind === "video") return isVideoMediaItem(item.media);
    return item.kind === "image" && isImageMediaItem(item.media) && typeof item.alt === "string" && item.alt.length <= 1000;
  });
}

/** Read-only compatibility. Never persist this projection during an unrelated edit. */
export function stepMediaItems(destination: StepMediaDestination): readonly StepMediaItem[] {
  if (destination.mediaItems !== undefined) return destination.mediaItems;
  const media = destination.mediaItem;
  if (!media) return [];
  return media.mediaType === "video"
    ? [{ id: `legacy:${media.id}`, label: "Watch", kind: "video", media }]
    : [{ id: `legacy:${media.id}`, label: "Image", kind: "image", media, alt: media.description }];
}
export function destinationMedia(destination: StepMediaDestination): MediaItem[] {
  return stepMediaItems(destination).flatMap((item) => item.kind === "activity" ? [] : [item.media]);
}
export function introductionVideo(destination: StepMediaDestination): VideoMediaItem | null {
  return stepMediaItems(destination).find((item): item is StepMediaItem & { kind: "video" } => item.kind === "video")?.media ?? null;
}
export function instructionalMedia(content: { intro: StepMediaDestination; steps: StepMediaDestination[] }): MediaItem[] {
  return [content.intro, ...content.steps].flatMap(destinationMedia);
}
export function withStepMedia<T extends StepMediaDestination>(destination: T, mediaItems: StepMediaItem[]): Omit<T, "mediaItem"> & { mediaItems: StepMediaItem[] } {
  const { mediaItem: _legacy, ...rest } = destination;
  void _legacy;
  return { ...rest, mediaItems };
}
export function hasModernStepMedia(content: { intro: StepMediaDestination; steps: StepMediaDestination[] } | null | undefined): boolean {
  return !!content && [content.intro, ...content.steps].some((destination) => destination.mediaItems !== undefined);
}

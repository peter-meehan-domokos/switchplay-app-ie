import type { ModernUserCardMediaItem } from "@/lib/userCardMedia";

export type CardMediaTarget = { deckUserId: string; deckTemplateId: string; cardId: string };
export type CardMediaRequest = CardMediaTarget & { mediaItemId: string };
export type OpenCardMedia = (cardId: string, mediaItemId: string, source: HTMLButtonElement) => void;
export type MediaSelection = { mediaItemId: string; index: number };

export function resolveMediaSelection(items: ModernUserCardMediaItem[], selection: MediaSelection): MediaSelection | null {
  if (!items.length) return null;
  const found = items.findIndex((item) => item.id === selection.mediaItemId);
  const index = found < 0 ? Math.max(0, Math.min(selection.index, items.length - 1)) : found;
  return { mediaItemId: items[index].id, index };
}

export function gallerySwipeDirection(dx: number, dy: number) {
  return Math.abs(dx) >= 50 && Math.abs(dx) > Math.abs(dy) * 1.4 ? (dx < 0 ? 1 : -1) : 0;
}

export type ImageTransform = { scale: number; x: number; y: number };
export const fittedImage: ImageTransform = { scale: 1, x: 0, y: 0 };
export function boundImageTransform(transform: ImageTransform, viewport: { width: number; height: number }, image: { width: number; height: number }): ImageTransform {
  const scale = Math.max(1, Math.min(4, transform.scale));
  const fit = Math.min(viewport.width / (image.width || 1), viewport.height / (image.height || 1));
  const maxX = Math.max(0, (image.width * fit * scale - viewport.width) / 2);
  const maxY = Math.max(0, (image.height * fit * scale - viewport.height) / 2);
  return { scale, x: maxX ? Math.max(-maxX, Math.min(maxX, transform.x)) : 0, y: maxY ? Math.max(-maxY, Math.min(maxY, transform.y)) : 0 };
}

export function cardMediaRequestUrl(target: CardMediaRequest, action: "playback" | "download") {
  return `/api/media/card?${new URLSearchParams({ ...target, action })}`;
}

export function cardMediaFileUrl(target: CardMediaRequest) {
  return `/api/media/card/file?${new URLSearchParams(target)}`;
}

export function cardMediaVideoFileUrl(target: CardMediaRequest) {
  return `/api/media/card/video-file?${new URLSearchParams(target)}`;
}

export type CardMediaDownload =
  | { status: "ready"; url: string; filename: string }
  | { status: "preparing"; progress?: number }
  | { status: "not-requested" }
  | { status: "failed" };

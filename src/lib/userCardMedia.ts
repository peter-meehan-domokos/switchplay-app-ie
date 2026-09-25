import {
  isCloudflareR2ImageMediaItem,
  isCloudflareStreamVideoMediaItem,
  type CloudflareR2ImageMediaItem,
  type CloudflareStreamVideoMediaItem,
  type MediaItem,
} from "@/lib/media";
import { createCloudflareStreamIframeUrl } from "@/lib/cloudflareStreamPlayback";

export type ModernUserCardMediaItem = CloudflareR2ImageMediaItem | CloudflareStreamVideoMediaItem;

type UserCardMediaContext = {
  cardId: string;
  deckTemplateId: string;
  userId: string;
};

type UserCardMediaValidationResult =
  | { ok: true; mediaItem: ModernUserCardMediaItem }
  | { ok: false; error: string };

const USER_CARD_IMAGE_FILENAME_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:avif|gif|jpg|png|webp)$/i;
const STREAM_ASSET_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

export function isModernUserCardMediaItem(value: unknown): value is ModernUserCardMediaItem {
  return isCloudflareR2ImageMediaItem(value) || isCloudflareStreamVideoMediaItem(value);
}

function getUserCardImagePrefix({ userId, deckTemplateId, cardId }: UserCardMediaContext) {
  return `user-decks/${userId}/${deckTemplateId}/cards/${cardId}/`;
}

function getImageItemId(assetId: string) {
  const filename = assetId.split("/").at(-1) ?? assetId;
  const stem = filename.replace(/\.[^.]+$/, "") || filename;

  return `image-${stem}`;
}

function getStreamThumbnailUrl(assetId: string) {
  return `https://videodelivery.net/${encodeURIComponent(assetId)}/thumbnails/thumbnail.jpg`;
}

export function validateUserCardMediaItem(
  value: unknown,
  context: UserCardMediaContext,
  createImagePublicUrl: (assetId: string) => string,
): UserCardMediaValidationResult {
  if (isCloudflareR2ImageMediaItem(value)) {
    const expectedPrefix = getUserCardImagePrefix(context);
    const filename = value.assetId.slice(expectedPrefix.length);

    if (!value.assetId.startsWith(expectedPrefix) || !USER_CARD_IMAGE_FILENAME_PATTERN.test(filename)) {
      return { ok: false, error: "Image assetId does not belong to this user card." };
    }

    if (value.id !== getImageItemId(value.assetId)) {
      return { ok: false, error: "Image media item id does not match its asset." };
    }

    if (value.src !== createImagePublicUrl(value.assetId)) {
      return { ok: false, error: "Image source URL does not match its user-card asset." };
    }

    return { ok: true, mediaItem: value };
  }

  if (isCloudflareStreamVideoMediaItem(value)) {
    if (!STREAM_ASSET_ID_PATTERN.test(value.assetId)) {
      return { ok: false, error: "Invalid Cloudflare Stream asset id." };
    }

    if (value.id !== `stream-${value.assetId}`) {
      return { ok: false, error: "Video media item id does not match its Stream asset." };
    }

    if (value.src !== createCloudflareStreamIframeUrl(value.assetId)) {
      return { ok: false, error: "Video source URL does not match its Stream asset." };
    }

    if (value.thumbnailSrc !== undefined && value.thumbnailSrc !== getStreamThumbnailUrl(value.assetId)) {
      return { ok: false, error: "Video thumbnail URL does not match its Stream asset." };
    }

    return { ok: true, mediaItem: value };
  }

  return { ok: false, error: "mediaItem must be a modern R2 image or Cloudflare Stream video." };
}

export function upsertUserCardMediaItem(
  mediaItems: MediaItem[],
  mediaItem: ModernUserCardMediaItem,
): MediaItem[] {
  return [
    ...mediaItems.filter((existingItem) => existingItem.mediaType !== mediaItem.mediaType),
    mediaItem,
  ];
}

export function appendUserCardMediaItem(
  mediaItems: MediaItem[],
  mediaItem: ModernUserCardMediaItem,
): MediaItem[] {
  if (mediaItems.some((existingItem) => existingItem.id === mediaItem.id)) {
    return mediaItems;
  }

  return [...mediaItems, mediaItem];
}

export function removeUserCardMediaItem(mediaItems: MediaItem[], mediaItemId: string): MediaItem[] {
  return mediaItems.filter((mediaItem) => mediaItem.id !== mediaItemId);
}

export function selectVisibleUserCardMediaItems(mediaItems: MediaItem[]): ModernUserCardMediaItem[] {
  const image = mediaItems.find(isCloudflareR2ImageMediaItem);
  const video = mediaItems.find(isCloudflareStreamVideoMediaItem);

  return [image, video].filter((mediaItem): mediaItem is ModernUserCardMediaItem => Boolean(mediaItem));
}

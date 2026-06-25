export type BaseMediaItem = {
  id: string;
  description: string;
};

export type ImageMediaItem = BaseMediaItem & {
  mediaType: "image";
  src: string;
};

export type CloudflareStreamVideoMediaItem = BaseMediaItem & {
  mediaType: "video";
  provider: "cloudflare-stream";
  assetId: string;
  src: string;
  thumbnailSrc?: string;
};

export type YouTubeVideoMediaItem = BaseMediaItem & {
  mediaType: "video";
  provider: "youtube";
  assetId: string;
  src: string;
  thumbnailSrc?: string;
};

export type VideoMediaItem =
  | CloudflareStreamVideoMediaItem
  | YouTubeVideoMediaItem;

export type MediaItem =
  | ImageMediaItem
  | VideoMediaItem;

export type LegacyProviderlessVideoMediaItem = BaseMediaItem & {
  mediaType: "video";
  src: string;
};

type MediaKindLike = {
  mediaType?: string;
};

type MediaTitleLike = {
  description?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasStringField(value: Record<string, unknown>, fieldName: string) {
  return typeof value[fieldName] === "string" && value[fieldName].trim().length > 0;
}

function hasOptionalStringField(value: Record<string, unknown>, fieldName: string) {
  return value[fieldName] === undefined || typeof value[fieldName] === "string";
}

function isBaseMediaItem(value: unknown): value is BaseMediaItem {
  return isRecord(value) && hasStringField(value, "id") && hasStringField(value, "description");
}

export function isImageMediaItem(value: unknown): value is ImageMediaItem {
  if (!isBaseMediaItem(value) || !isRecord(value)) {
    return false;
  }
  const mediaItem = value as BaseMediaItem & Record<string, unknown>;

  return mediaItem.mediaType === "image" && hasStringField(mediaItem, "src");
}

export function isCloudflareStreamVideoMediaItem(value: unknown): value is CloudflareStreamVideoMediaItem {
  if (!isBaseMediaItem(value) || !isRecord(value)) {
    return false;
  }
  const mediaItem = value as BaseMediaItem & Record<string, unknown>;

  return (
    mediaItem.mediaType === "video" &&
    mediaItem.provider === "cloudflare-stream" &&
    hasStringField(mediaItem, "assetId") &&
    hasStringField(mediaItem, "src") &&
    hasOptionalStringField(mediaItem, "thumbnailSrc")
  );
}

export function isYouTubeVideoMediaItem(value: unknown): value is YouTubeVideoMediaItem {
  if (!isBaseMediaItem(value) || !isRecord(value)) {
    return false;
  }
  const mediaItem = value as BaseMediaItem & Record<string, unknown>;

  return (
    mediaItem.mediaType === "video" &&
    mediaItem.provider === "youtube" &&
    hasStringField(mediaItem, "assetId") &&
    hasStringField(mediaItem, "src") &&
    hasOptionalStringField(mediaItem, "thumbnailSrc")
  );
}

export function isVideoMediaItem(value: unknown): value is VideoMediaItem {
  return isCloudflareStreamVideoMediaItem(value) || isYouTubeVideoMediaItem(value);
}

export function isLegacyProviderlessVideoMediaItem(value: unknown): value is LegacyProviderlessVideoMediaItem {
  if (!isBaseMediaItem(value) || !isRecord(value)) {
    return false;
  }
  const mediaItem = value as BaseMediaItem & Record<string, unknown>;

  return mediaItem.mediaType === "video" && mediaItem.provider === undefined && hasStringField(mediaItem, "src");
}

export function isMediaItem(value: unknown): value is MediaItem {
  return isImageMediaItem(value) || isVideoMediaItem(value);
}

export function getMediaKindLabel(mediaItem?: MediaKindLike): string {
  if (!mediaItem) {
    return "Guide";
  }

  if (mediaItem.mediaType === "image") {
    return "Image";
  }

  if (mediaItem.mediaType === "video") {
    return "Video";
  }

  return "Media";
}

export function getMediaTitle(mediaItem: MediaTitleLike | undefined, fallback: string): string {
  return mediaItem?.description ?? fallback;
}

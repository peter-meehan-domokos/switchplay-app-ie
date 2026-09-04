export type BaseMediaItem = {
  id: string;
  description: string;
};

export type CloudflareR2ImageMediaItem = BaseMediaItem & {
  mediaType: "image";
  provider: "cloudflare-r2";
  assetId: string;
  src: string;
};

export type LegacyProviderlessImageMediaItem = BaseMediaItem & {
  mediaType: "image";
  src: string;
};

export type ImageMediaItem =
  | CloudflareR2ImageMediaItem
  | LegacyProviderlessImageMediaItem;

export type CloudflareStreamVideoMediaItem = BaseMediaItem & {
  mediaType: "video";
  provider: "cloudflare-stream";
  assetId: string;
  src: string;
  thumbnailSrc?: string;
  width?: number;
  height?: number;
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

function hasOptionalPositiveNumberField(value: Record<string, unknown>, fieldName: string) {
  return (
    value[fieldName] === undefined ||
    (typeof value[fieldName] === "number" && Number.isFinite(value[fieldName]) && value[fieldName] > 0)
  );
}

function isBaseMediaItem(value: unknown): value is BaseMediaItem {
  return isRecord(value) && hasStringField(value, "id") && hasStringField(value, "description");
}

export function isCloudflareR2ImageMediaItem(value: unknown): value is CloudflareR2ImageMediaItem {
  if (!isBaseMediaItem(value) || !isRecord(value)) {
    return false;
  }
  const mediaItem = value as BaseMediaItem & Record<string, unknown>;

  return (
    mediaItem.mediaType === "image" &&
    mediaItem.provider === "cloudflare-r2" &&
    hasStringField(mediaItem, "assetId") &&
    hasStringField(mediaItem, "src")
  );
}

export function isLegacyProviderlessImageMediaItem(value: unknown): value is LegacyProviderlessImageMediaItem {
  if (!isBaseMediaItem(value) || !isRecord(value)) {
    return false;
  }
  const mediaItem = value as BaseMediaItem & Record<string, unknown>;

  return mediaItem.mediaType === "image" && mediaItem.provider === undefined && hasStringField(mediaItem, "src");
}

export function isImageMediaItem(value: unknown): value is ImageMediaItem {
  return isCloudflareR2ImageMediaItem(value) || isLegacyProviderlessImageMediaItem(value);
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
    hasOptionalStringField(mediaItem, "thumbnailSrc") &&
    hasOptionalPositiveNumberField(mediaItem, "width") &&
    hasOptionalPositiveNumberField(mediaItem, "height")
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

export function isKnownPortraitCloudflareStreamVideoMediaItem(mediaItem: CloudflareStreamVideoMediaItem) {
  return (
    typeof mediaItem.width === "number" &&
    typeof mediaItem.height === "number" &&
    mediaItem.height > mediaItem.width
  );
}

export function isKnownLandscapeCloudflareStreamVideoMediaItem(mediaItem: CloudflareStreamVideoMediaItem) {
  return (
    typeof mediaItem.width === "number" &&
    typeof mediaItem.height === "number" &&
    mediaItem.width > mediaItem.height
  );
}

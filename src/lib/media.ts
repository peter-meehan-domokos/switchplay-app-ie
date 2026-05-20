export type MediaItem = {
  id: string;
  mediaType: "image" | "video";
  description: string;
  src: string;
};

type MediaKindLike = {
  mediaType?: string;
};

type MediaTitleLike = {
  description?: string;
};

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

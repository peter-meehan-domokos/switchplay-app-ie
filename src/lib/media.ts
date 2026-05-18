type MediaItemLike = {
  alt?: string;
  mediaType?: string;
  provider?: string;
  title?: string;
};

export function getMediaKindLabel(mediaItem?: MediaItemLike): string {
  if (!mediaItem) {
    return "Guide";
  }

  if (mediaItem.mediaType === "img") {
    return "Image";
  }

  if (mediaItem.mediaType === "embeddedVideo") {
    return mediaItem.provider === "youtube" ? "YouTube" : "Embed";
  }

  if (mediaItem.mediaType === "video") {
    return "Video";
  }

  return "Media";
}

export function getMediaTitle(mediaItem: MediaItemLike | undefined, fallback: string): string {
  return mediaItem?.title ?? mediaItem?.alt ?? fallback;
}

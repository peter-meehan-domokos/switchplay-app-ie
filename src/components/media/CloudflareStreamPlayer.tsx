import type { CloudflareStreamVideoMediaItem } from "@/lib/media";

type CloudflareStreamPlayerProps = {
  mediaItem: CloudflareStreamVideoMediaItem;
};

function createCloudflareStreamIframeUrl(assetId: string) {
  return `https://iframe.videodelivery.net/${encodeURIComponent(assetId)}`;
}

function createCloudflareStreamThumbnailUrl(assetId: string) {
  return `https://videodelivery.net/${encodeURIComponent(assetId)}/thumbnails/thumbnail.jpg`;
}

function isValidCloudflareStreamIframeUrl(value: string) {
  try {
    const url = new URL(value);

    return url.protocol === "https:" && url.hostname === "iframe.videodelivery.net";
  } catch {
    return false;
  }
}

function isValidCloudflareStreamThumbnailUrl(value: string) {
  try {
    const url = new URL(value);

    return url.protocol === "https:";
  } catch {
    return false;
  }
}

export function getCloudflareStreamIframeUrl(mediaItem: CloudflareStreamVideoMediaItem) {
  return isValidCloudflareStreamIframeUrl(mediaItem.src)
    ? mediaItem.src
    : createCloudflareStreamIframeUrl(mediaItem.assetId);
}

export function getCloudflareStreamThumbnailUrl(mediaItem: CloudflareStreamVideoMediaItem) {
  return mediaItem.thumbnailSrc && isValidCloudflareStreamThumbnailUrl(mediaItem.thumbnailSrc)
    ? mediaItem.thumbnailSrc
    : createCloudflareStreamThumbnailUrl(mediaItem.assetId);
}

export default function CloudflareStreamPlayer({ mediaItem }: CloudflareStreamPlayerProps) {
  return (
    <iframe
      className="cloudflare-stream-player"
      src={getCloudflareStreamIframeUrl(mediaItem)}
      title={mediaItem.description || "Step video"}
      allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
      allowFullScreen
      loading="lazy"
    />
  );
}

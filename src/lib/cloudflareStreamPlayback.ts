import type { CloudflareStreamVideoMediaItem } from "@/lib/media";

function createCloudflareStreamAssetUrl(assetId: string, path: string) {
  return `https://videodelivery.net/${encodeURIComponent(assetId)}${path}`;
}

function isValidHttpsUrl(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function isCloudflareStreamPlaybackHost(hostname: string) {
  return (
    hostname === "videodelivery.net" ||
    hostname === "iframe.videodelivery.net" ||
    hostname === "cloudflarestream.com" ||
    hostname.endsWith(".cloudflarestream.com")
  );
}

function getCloudflareStreamPathId(sourceUrl: URL, fallbackAssetId: string) {
  const pathId = sourceUrl.pathname.split("/").filter(Boolean)[0];

  return pathId || fallbackAssetId;
}

export function createCloudflareStreamIframeUrl(assetId: string) {
  return `https://iframe.videodelivery.net/${encodeURIComponent(assetId)}`;
}

export function getCloudflareStreamHlsManifestUrl(mediaItem: CloudflareStreamVideoMediaItem) {
  try {
    const sourceUrl = new URL(mediaItem.src);

    if (sourceUrl.protocol === "https:" && sourceUrl.pathname.endsWith("/manifest/video.m3u8")) {
      return sourceUrl.toString();
    }

    if (sourceUrl.protocol === "https:" && isCloudflareStreamPlaybackHost(sourceUrl.hostname)) {
      const manifestHost = sourceUrl.hostname === "iframe.videodelivery.net" ? "videodelivery.net" : sourceUrl.hostname;
      const playbackId = getCloudflareStreamPathId(sourceUrl, mediaItem.assetId);

      return `https://${manifestHost}/${encodeURIComponent(playbackId)}/manifest/video.m3u8`;
    }
  } catch {
    // Fall through to the legacy public Stream URL shape used by current persisted media.
  }

  return createCloudflareStreamAssetUrl(mediaItem.assetId, "/manifest/video.m3u8");
}

export function getCloudflareStreamThumbnailUrl(mediaItem: CloudflareStreamVideoMediaItem) {
  return mediaItem.thumbnailSrc && isValidHttpsUrl(mediaItem.thumbnailSrc)
    ? mediaItem.thumbnailSrc
    : createCloudflareStreamAssetUrl(mediaItem.assetId, "/thumbnails/thumbnail.jpg");
}

import type { CloudflareStreamVideoMediaItem } from "@/lib/media";

type CloudflareStreamPlayerProps = {
  mediaItem: CloudflareStreamVideoMediaItem;
};

function createCloudflareStreamIframeUrl(assetId: string) {
  return `https://iframe.videodelivery.net/${encodeURIComponent(assetId)}`;
}

function isValidCloudflareStreamIframeUrl(value: string) {
  try {
    const url = new URL(value);

    return url.protocol === "https:" && url.hostname === "iframe.videodelivery.net";
  } catch {
    return false;
  }
}

export function getCloudflareStreamIframeUrl(mediaItem: CloudflareStreamVideoMediaItem) {
  return isValidCloudflareStreamIframeUrl(mediaItem.src)
    ? mediaItem.src
    : createCloudflareStreamIframeUrl(mediaItem.assetId);
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

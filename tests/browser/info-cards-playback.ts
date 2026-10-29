// Fixture transport only: the actual player, decoder, controls and lifecycle
// remain in use. Existing non-info fixture media keeps its normal URLs.
import * as production from "../../src/lib/cloudflareStreamPlayback";
import type { CloudflareStreamVideoMediaItem } from "@/lib/media";

export const createCloudflareStreamIframeUrl = production.createCloudflareStreamIframeUrl;
export function getCloudflareStreamHlsManifestUrl(media: CloudflareStreamVideoMediaItem) {
  return media.assetId.startsWith("info-fixture-")
    ? `${location.origin}/info-cards-media/sample.mp4?asset=${encodeURIComponent(media.assetId)}`
    : production.getCloudflareStreamHlsManifestUrl(media);
}
export function getCloudflareStreamThumbnailUrl(media: CloudflareStreamVideoMediaItem) {
  return media.assetId.startsWith("info-fixture-") ? `${location.origin}/image-0.svg` : production.getCloudflareStreamThumbnailUrl(media);
}

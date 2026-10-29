import type { MediaItem } from "@/lib/media";
import { streamPlaybackGrant } from "@/lib/cards/protectedMedia";
import type { CloudflareStreamVideoMediaItem } from "@/lib/media";
import type { CardMediaDownload } from "@/lib/cardMediaViewer";
import { getCloudflareStreamVideoStatus, requestCloudflareStreamDownload, type StreamDownload } from "@/lib/cloudflareStream";

export function mediaDownloadFilename(item: MediaItem) {
  const candidateExtension = item.mediaType === "video" ? "mp4" : ("assetId" in item ? item.assetId : new URL(item.src, "https://local.invalid").pathname).split(".").at(-1)?.toLowerCase() || "image";
  const extension = /^(?:avif|gif|jpg|jpeg|png|webp|mp4)$/.test(candidateExtension) ? candidateExtension : "bin";
  const stem = item.description.replace(/\.[a-z0-9]{2,5}$/i, "").normalize("NFKD").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100) || "card-media";
  return `${stem}.${extension}`;
}

function downloadResult(download: StreamDownload | null, filename: string): CardMediaDownload {
  if (!download) return { status: "not-requested" };
  if (download.status === "error") return { status: "failed" };
  if (download.status !== "ready") return { status: "preparing", progress: download.percentComplete };
  const url = new URL(download.url ?? "");
  if (url.protocol !== "https:" || !(url.hostname === "videodelivery.net" || url.hostname.endsWith(".cloudflarestream.com")) || !url.pathname.endsWith("/downloads/default.mp4")) {
    throw new Error("Stream returned an invalid download URL.");
  }
  // Stream appends the extension to this parameter and sends download headers.
  url.searchParams.set("filename", filename.replace(/\.mp4$/, ""));
  return { status: "ready", url: url.toString(), filename };
}

const dependencies = {
  videoStatus: getCloudflareStreamVideoStatus,
  download: requestCloudflareStreamDownload,
  grant: (assetId: string) => streamPlaybackGrant(assetId, fetch, true),
};

export async function getCardMediaDownload(item: CloudflareStreamVideoMediaItem, prepare: boolean, deps = dependencies): Promise<CardMediaDownload> {
  const filename = mediaDownloadFilename(item);
  // Playback processing and MP4 generation are distinct states.
  const video = await deps.videoStatus(item.assetId);
  if (video.status === "failed") return { status: "failed" };
  if (video.status !== "ready") return { status: "preparing", progress: video.progress };
  let download = await deps.download(item.assetId, "GET");
  if (prepare && (!download || download.status === "error")) download = await deps.download(item.assetId, "POST");
  const result = downloadResult(download, filename);
  if (result.status !== "ready") return result;
  const grant = await deps.grant(item.assetId);
  const url = new URL(grant.manifestUrl.replace("/manifest/video.m3u8", "/downloads/default.mp4"));
  url.searchParams.set("filename", filename.replace(/\.mp4$/, ""));
  return { ...result, url: url.toString() };
}

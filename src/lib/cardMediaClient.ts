import { groupMediaUrl } from "./mediaCollection/presentation";
import { cardMediaRequestUrl, type GalleryMediaRequest as CardMediaRequest, type CardMediaDownload } from "@/lib/cardMediaViewer";
import { StreamVideoReadinessRequestError, type StreamVideoReadinessStatus } from "@/lib/mediaUploadClient";

async function readResponse(response: Response) {
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error || "Unable to access this media. Please retry.");
  return body;
}

export async function requestCardVideoReadiness(target: CardMediaRequest, signal: AbortSignal): Promise<StreamVideoReadinessStatus & { grant?: import("./cardPlaybackGrants").PlaybackGrant }> {
  try {
    const response = await fetch(target.groupMedia ? groupMediaUrl(target.groupMedia, "playback", target.groupMedia.experienceId ? { experienceId: target.groupMedia.experienceId, subjectUserId: target.groupMedia.subjectUserId } : undefined) : cardMediaRequestUrl(target, "playback"), { signal, cache: "no-store", headers: { "X-Group-Viewer": target.viewerUserId } });
    if (target.groupMedia && (response.headers.get("X-Group-Viewer") ?? response.headers.get("X-Personal-Viewer")) !== target.viewerUserId) throw Error("Your account changed. Reopen the viewer.");
    const body = await readResponse(response);
    if (target.groupMedia) body.viewerUserId = target.viewerUserId;
    if (body.viewerUserId !== target.viewerUserId) throw new Error("Your account changed. Reopen the viewer.");
    if (body?.status === "ready") {
      const grant = body.grant;
      const validUrl = (url: unknown, suffix: string) => {
        try { const parsed = new URL(String(url)); return parsed.origin === "https://videodelivery.net" && parsed.pathname.endsWith(suffix); } catch { return false; }
      };
      if (!grant || typeof grant.assetId !== "string" || !Number.isFinite(grant.expiresAt) || grant.expiresAt <= Date.now() + 30000
        || !validUrl(grant.manifestUrl, "/manifest/video.m3u8") || !validUrl(grant.thumbnailUrl, "/thumbnails/thumbnail.jpg")) throw new Error("Video authorization unavailable.");
    }
    if (!["ready", "processing", "failed"].includes(body?.status)) throw new Error("Unable to read video status.");
    return body;
  } catch (error) {
    if (signal.aborted) throw error;
    // Network/auth failures must not be mislabeled as confirmed video processing.
    throw new StreamVideoReadinessRequestError(error instanceof Error ? error.message : "Unable to check video status.", false);
  }
}

export async function requestCardMediaDownload(target: CardMediaRequest, prepare: boolean, signal: AbortSignal): Promise<CardMediaDownload> {
  if (target.groupMedia) {
    const g = target.groupMedia, authority = g.experienceId ? { experienceId: g.experienceId, subjectUserId: g.subjectUserId } : undefined;
    const read = async (url: string, method = "GET") => {
      const response = await fetch(url, { method, cache: "no-store", signal, headers: { "X-Group-Viewer": target.viewerUserId } });
      if ((response.headers.get("X-Group-Viewer") ?? response.headers.get("X-Personal-Viewer")) !== target.viewerUserId) throw Error("Your account changed. Reopen the viewer.");
      return readResponse(response);
    };
    if (g.mediaType === "image") {
      await read(groupMediaUrl(g, "status", authority));
      return { status: "ready", url: groupMediaUrl(g, "download", authority), filename: "card-media" };
    }
    const value = await read(groupMediaUrl(g, "download", authority), prepare ? "POST" : "GET");
    if (!["ready", "preparing", "not-requested", "failed"].includes(value.status)) throw Error("Unable to read download status.");
    if (value.status === "ready") {
      const url = new URL(value.url);
      if (url.protocol !== "https:" || !(url.hostname === "videodelivery.net" || url.hostname.endsWith(".cloudflarestream.com")) || !url.pathname.endsWith("/downloads/default.mp4") || typeof value.filename !== "string") throw Error("Unable to read download status.");
    }
    return value;
  }
  const response = await fetch(prepare ? "/api/media/card" : cardMediaRequestUrl(target, "download"), {
    method: prepare ? "POST" : "GET",
    ...(prepare ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(target) } : {}),
    cache: "no-store", signal,
  });
  const body = await readResponse(response);
  const validUrl = typeof body?.url === "string" &&
    (body.url.startsWith("https://") || (body.url.startsWith("/api/media/card/file?") && !body.url.startsWith("//")));
  if (!["ready", "preparing", "not-requested", "failed"].includes(body?.status) ||
      (body.status === "ready" && (!validUrl || typeof body.filename !== "string"))) {
    throw new Error("Unable to read download status.");
  }
  return body;
}

export type DownloadState = { status: "idle" } | CardMediaDownload | { status: "error"; message: string };

export function startCardMediaDownload(target: CardMediaRequest, onState: (state: DownloadState) => void, onReady: (download: Extract<CardMediaDownload, { status: "ready" }>) => void, options: {
  request?: typeof requestCardMediaDownload;
  schedule?: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
  cancel?: (timer: ReturnType<typeof setTimeout>) => void;
  maxChecks?: number;
} = {}) {
  const controller = new AbortController();
  const request = options.request ?? requestCardMediaDownload;
  const schedule = options.schedule ?? setTimeout;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let checks = 0;
  let stopped = false;
  const check = async (prepare: boolean) => {
    try {
      let result = await request(target, prepare, controller.signal);
      if (stopped) return;
      // A video may finish Stream processing after the initial POST.
      if (result.status === "not-requested" && !prepare) result = await request(target, true, controller.signal);
      if (stopped) return;
      if (result.status === "failed") throw new Error("Download preparation failed. Please retry.");
      if (result.status === "ready") { onState(result); onReady(result); return; }
      checks += 1;
      if (checks >= (options.maxChecks ?? 60)) throw new Error("Download preparation is taking longer than expected. Please retry.");
      onState({ ...result, status: "preparing" });
      timer = schedule(() => { void check(false); }, Math.min(10_000, 1500 * 1.25 ** checks));
    } catch (error) {
      if (!stopped) onState({ status: "error", message: error instanceof Error ? error.message : "Unable to prepare download." });
    }
  };
  onState({ status: "preparing" });
  void check(true);
  return () => { stopped = true; controller.abort(); if (timer !== undefined) (options.cancel ?? clearTimeout)(timer); };
}

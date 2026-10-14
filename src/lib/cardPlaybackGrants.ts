import type { CloudflareStreamVideoMediaItem } from "./media";

export type CardPlaybackContext = { viewerUserId: string; cardTemplateId: string; version: number; mode: "working" | "canonical" };
export type PlaybackGrant = { assetId: string; manifestUrl: string; thumbnailUrl: string; expiresAt: number; reuseUntil: number };

// One mounted Card/learner/version only. No storage, global cache or media buffers.
export function createCardPlaybackGrants(context: CardPlaybackContext, fetchImpl: typeof fetch = fetch, now = Date.now) {
  const grants = new Map<string, PlaybackGrant>();
  let generation = 0;
  const peek = (assetId: string) => {
    const grant = grants.get(assetId);
    if (grant && now() < grant.reuseUntil && now() < grant.expiresAt - 30_000) return grant;
    grants.delete(assetId);
  };
  return {
    peek,
    clear() { generation += 1; grants.clear(); },
    async read(item: CloudflareStreamVideoMediaItem, signal: AbortSignal): Promise<PlaybackGrant> {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      const cached = peek(item.assetId);
      if (cached) return cached;
      const started = now(), readingGeneration = generation;
      const query = new URLSearchParams({ provider: "stream", identity: item.assetId, format: "grant",
        cardTemplateId: context.cardTemplateId, version: String(context.version), mode: context.mode });
      const response = await fetchImpl(`/api/media/protected?${query}`, {
        headers: { "X-Personal-Viewer": context.viewerUserId }, cache: "no-store", signal,
      });
      if (!response.ok) throw new Error("Video authorization unavailable");
      const grant = await response.json() as PlaybackGrant & { viewerUserId: string };
      if (readingGeneration !== generation || signal.aborted) throw new DOMException("Aborted", "AbortError");
      const validUrl = (value: string, path: string) => {
        const url = new URL(value);
        return url.origin === "https://videodelivery.net" && url.pathname.endsWith(path);
      };
      if (grant.viewerUserId !== context.viewerUserId || grant.assetId !== item.assetId
        || !Number.isFinite(grant.expiresAt) || !Number.isFinite(grant.reuseUntil)
        || !validUrl(grant.manifestUrl, "/manifest/video.m3u8") || !validUrl(grant.thumbnailUrl, "/thumbnails/thumbnail.jpg")) {
        throw new Error("Video authorization context changed");
      }
      grant.reuseUntil = Math.min(grant.reuseUntil, started + 300_000, grant.expiresAt - 30_000);
      if (now() >= grant.reuseUntil) throw new Error("Video authorization expired");
      grants.set(item.assetId, grant);
      return grant;
    },
  };
}

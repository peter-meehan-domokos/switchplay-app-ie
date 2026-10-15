import type { CloudflareStreamVideoMediaItem } from "./media";

export const PLAYBACK_GRANT_REUSE_MS = 10 * 60_000;
const REFRESH_AHEAD_MS = 60_000;
export type CardPlaybackContext = { viewerUserId: string; cardTemplateId: string; version: number; mode: "working" | "canonical" };
export type PlaybackGrant = { assetId: string; manifestUrl: string; thumbnailUrl: string; expiresAt: number; reuseUntil: number };
type PendingGrant = { controller: AbortController; promise: Promise<PlaybackGrant>; consumers: number };

// One mounted Card/learner/version only. No storage, global cache or media buffers.
export function createCardPlaybackGrants(context: CardPlaybackContext, fetchImpl: typeof fetch = fetch, now = Date.now) {
  context = { ...context };
  const grants = new Map<string, PlaybackGrant>(), pending = new Map<string, PendingGrant>();
  let generation = 0;
  const aborted = () => new DOMException("Aborted", "AbortError");
  const peek = (assetId: string) => {
    const grant = grants.get(assetId);
    if (grant && now() < grant.reuseUntil && now() < grant.expiresAt - 30_000) return grant;
    grants.delete(assetId);
  };
  const clear = () => {
    generation += 1; grants.clear();
    for (const entry of pending.values()) entry.controller.abort();
    pending.clear();
  };
  const request = async (item: CloudflareStreamVideoMediaItem, signal: AbortSignal) => {
    const started = now(), readingGeneration = generation;
    const query = new URLSearchParams({ provider: "stream", identity: item.assetId, format: "grant",
      cardTemplateId: context.cardTemplateId, version: String(context.version), mode: context.mode });
    const response = await fetchImpl(`/api/media/protected?${query}`, {
      headers: { "X-Personal-Viewer": context.viewerUserId }, cache: "no-store", signal,
    });
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) clear();
      throw new Error("Video authorization unavailable");
    }
    const grant = await response.json() as PlaybackGrant & { viewerUserId: string };
    if (readingGeneration !== generation || signal.aborted) throw aborted();
    const validUrl = (value: string, path: string) => {
      const url = new URL(value);
      return url.origin === "https://videodelivery.net" && url.pathname.endsWith(path);
    };
    if (grant.viewerUserId !== context.viewerUserId || grant.assetId !== item.assetId
      || !Number.isFinite(grant.expiresAt) || !Number.isFinite(grant.reuseUntil)
      || !validUrl(grant.manifestUrl, "/manifest/video.m3u8") || !validUrl(grant.thumbnailUrl, "/thumbnails/thumbnail.jpg")) {
      clear(); throw new Error("Video authorization context changed");
    }
    grant.reuseUntil = Math.min(grant.reuseUntil, started + PLAYBACK_GRANT_REUSE_MS, grant.expiresAt - 30_000);
    if (now() >= grant.reuseUntil) throw new Error("Video authorization expired");
    grants.set(item.assetId, grant);
    return grant;
  };
  const read = (item: CloudflareStreamVideoMediaItem, signal: AbortSignal, refresh = false): Promise<PlaybackGrant> => {
    if (signal.aborted) return Promise.reject(aborted());
    const cached = peek(item.assetId);
    if (cached && !refresh) return Promise.resolve(cached);
    let entry = pending.get(item.assetId);
    if (!entry) {
      const controller = new AbortController();
      entry = { controller, consumers: 0, promise: request(item, controller.signal).finally(() => {
        if (pending.get(item.assetId) === entry) pending.delete(item.assetId);
      }) };
      pending.set(item.assetId, entry);
    }
    const reading = entry;
    reading.consumers += 1;
    return new Promise((resolve, reject) => {
      let finished = false;
      const release = () => {
        if (finished) return false;
        finished = true; signal.removeEventListener("abort", cancel);
        reading.consumers -= 1;
        if (!reading.consumers && pending.get(item.assetId) === reading) {
          pending.delete(item.assetId); reading.controller.abort();
        }
        return true;
      };
      const cancel = () => { if (release()) reject(aborted()); };
      signal.addEventListener("abort", cancel, { once: true });
      reading.promise.then(value => { if (release()) resolve(value); }, error => { if (release()) reject(error); });
      if (signal.aborted) cancel();
    });
  };
  return {
    peek, clear, read,
    // Independent requests: intro playback never waits for the other tokens.
    prepare(items: readonly CloudflareStreamVideoMediaItem[], signal: AbortSignal, onGrant?: (grant: PlaybackGrant) => void) {
      const distinct = [...new Map(items.map(item => [item.assetId, item])).values()];
      return Promise.allSettled(distinct.map(item => {
        const cached = peek(item.assetId);
        return read(item, signal, !!cached && cached.reuseUntil - now() <= REFRESH_AHEAD_MS).then(grant => {
          if (!signal.aborted) onGrant?.(grant);
          return grant;
        });
      }));
    },
  };
}

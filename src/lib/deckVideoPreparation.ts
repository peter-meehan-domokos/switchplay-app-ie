import { createCardPlaybackGrants, type CardPlaybackContext, type PlaybackGrant } from "./cardPlaybackGrants";
import { createCardVideoThumbnails } from "./cardVideoThumbnails";
import { getCloudflareStreamThumbnailUrl } from "./cloudflareStreamPlayback";
import type { CloudflareStreamVideoMediaItem } from "./media";

export type DeckVideoCard = { key: string; context: CardPlaybackContext | null; intro: CloudflareStreamVideoMediaItem | null };
export function introductionWindow(length: number, active: number): number[] {
  if (!length || active < 0 || active >= length) return [];
  const start = length <= 7 ? 0 : Math.max(0, Math.min(active - 2, length - 7));
  return Array.from({ length: Math.min(7, length) }, (_, offset) => start + offset);
}

// Resources belong to one open Deck, never a global or persistent cache.
export function createDeckVideoPreparation(options: { fetch?: typeof fetch; createImage?: () => HTMLImageElement; now?: () => number } = {}) {
  const records = new Map<string, ReturnType<typeof makeResource>>();
  const jobs = new Map<string, AbortController>();
  const failed = new Set<string>();
  let cards: readonly DeckVideoCard[] = [], active = -1, windowKeys = new Set<string>();
  let hidden = false, focused: string | null = null, videoOpen = false, disposed = false;
  let pumping = false;
  const now = options.now ?? Date.now;
  function makeResource(card: DeckVideoCard) {
    const listeners = new Set<() => void>();
    let revision = 0;
    const resource = {
      card, settled: false,
      grants: card.context ? createCardPlaybackGrants(card.context, options.fetch, now) : null,
      thumbnails: createCardVideoThumbnails(() => { resource.notify(); pump(); }, options.createImage, now),
      subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
      snapshot: () => revision,
      notify() { revision++; for (const listener of listeners) listener(); },
      introGrant(): Pick<PlaybackGrant, "assetId" | "thumbnailUrl" | "expiresAt" | "reuseUntil"> | undefined {
        if (!card.intro) return;
        return resource.grants ? resource.grants.peek(card.intro.assetId) : {
          assetId: card.intro.assetId, thumbnailUrl: getCloudflareStreamThumbnailUrl(card.intro), expiresAt: Infinity, reuseUntil: Infinity,
        };
      },
      dispose() { resource.grants?.clear(); resource.thumbnails.clear(); },
    };
    return resource;
  }
  function resource(card: DeckVideoCard) {
    let entry = records.get(card.key);
    if (!entry) { entry = makeResource(card); records.set(card.key, entry); }
    return entry;
  }
  function cancel(key: string, controller: AbortController) {
    jobs.delete(key); controller.abort();
    // A promoted active/focused Card owns its own foreground preparation.
    if (key !== cards[active]?.key && key !== focused) records.get(key)?.thumbnails.cancelPending();
  }
  function pump() {
    if (pumping || disposed) return;
    pumping = true;
    try {
      const activeResource = cards[active] ? resource(cards[active]) : null;
      const grant = activeResource?.introGrant();
      const state = grant ? activeResource?.thumbnails.peek(grant)?.state : undefined;
      const ready = !activeResource?.card.intro || activeResource.settled || state === "ready" || state === "failed";
      const paused = hidden || videoOpen || !ready;
      for (const [key, controller] of jobs) if (!windowKeys.has(key) || hidden || (paused && key !== cards[active]?.key)) cancel(key, controller);
      if (paused) return;
      const candidates = introductionWindow(cards.length, active)
        .sort((a, b) => Math.abs(a - active) - Math.abs(b - active) || b - a);
      for (const index of candidates) {
        if (jobs.size >= 2) break;
        const card = cards[index], entry = resource(card);
        // The cold active front has already downloaded its image. Do not issue
        // another request just to warm a cache; focusing retains its normal path.
        if (!card.intro || index === active || card.key === focused || jobs.has(card.key) || failed.has(card.key)) continue;
        const cached = entry.introGrant();
        if (cached && entry.thumbnails.peek(cached)) continue;
        const controller = new AbortController(); jobs.set(card.key, controller);
        void (async () => {
          const grant = entry.grants ? await entry.grants.read(card.intro!, controller.signal) : entry.introGrant()!;
          if (controller.signal.aborted || !windowKeys.has(card.key)) return;
          entry.thumbnails.prepare(grant, "low"); entry.notify();
          // Count the image download/decode, not just token issuance, as a job.
          await new Promise<void>(resolve => {
            const finish = () => { unsubscribe(); controller.signal.removeEventListener("abort", finish); resolve(); };
            const check = () => { if (entry.thumbnails.peek(grant)?.state !== "loading") finish(); };
            const unsubscribe = entry.subscribe(check);
            controller.signal.addEventListener("abort", finish, { once: true });
            if (controller.signal.aborted) finish(); else check();
          });
        })().catch(() => {
          // One unavailable neighbour must not break the Deck or retry forever.
          if (!controller.signal.aborted) failed.add(card.key);
        }).finally(() => {
          if (jobs.get(card.key) === controller) jobs.delete(card.key);
          pump();
        });
      }
    } finally { pumping = false; }
  }
  return {
    resource,
    update(next: readonly DeckVideoCard[], index: number) {
      disposed = false;
      cards = next; active = index;
      windowKeys = new Set(introductionWindow(cards.length, active).map(i => cards[i].key));
      failed.clear();
      const present = new Set(cards.map(card => card.key));
      for (const [key, entry] of records) {
        if (!present.has(key)) { const job = jobs.get(key); if (job) cancel(key, job); records.delete(key); entry.dispose(); }
        else if (!windowKeys.has(key) && key !== focused && entry.thumbnails.clear()) entry.notify();
      }
      pump();
    },
    settled(key: string) { const entry = records.get(key); if (entry) { entry.settled = true; pump(); } },
    setHidden(value: boolean) { hidden = value; pump(); },
    focus(key: string | null) {
      const previous = focused; focused = key;
      if (previous && previous !== key) {
        const entry = records.get(previous);
        entry?.thumbnails.retainOnly(windowKeys.has(previous) && entry.card.intro ? [entry.card.intro.assetId] : []);
      }
      pump();
    },
    setVideoOpen(value: boolean) { videoOpen = value; pump(); },
    dispose() {
      disposed = true;
      for (const [key, job] of jobs) cancel(key, job);
      for (const entry of records.values()) entry.dispose();
    },
  };
}
export type DeckVideoPreparation = ReturnType<typeof createDeckVideoPreparation>;
export type DeckVideoResource = ReturnType<DeckVideoPreparation["resource"]>;

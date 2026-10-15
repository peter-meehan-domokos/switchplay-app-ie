import type { PlaybackGrant } from "./cardPlaybackGrants";

type ThumbnailGrant = Pick<PlaybackGrant, "assetId" | "thumbnailUrl" | "reuseUntil" | "expiresAt">;
type Thumbnail = { image: HTMLImageElement; url: string; validUntil: number; state: "loading" | "ready" | "failed" };

// Keep the decoded image itself, so displaying it never assigns src a second
// time or depends on the browser retaining a separate preload in its HTTP cache.
export function createCardVideoThumbnails(onChange: () => void, createImage = () => new Image(), now = Date.now) {
  const entries = new Map<string, Thumbnail>();
  const dispose = (entry: Thumbnail) => {
    entry.image.onload = null; entry.image.onerror = null;
    entry.image.remove(); entry.image.removeAttribute("src");
  };
  return {
    peek(grant: ThumbnailGrant) {
      const entry = entries.get(grant.assetId);
      return entry?.url === grant.thumbnailUrl && now() < entry.validUntil ? entry : undefined;
    },
    prepare(grant: ThumbnailGrant, priority: "auto" | "low" = "auto") {
      const previous = entries.get(grant.assetId);
      if (previous?.url === grant.thumbnailUrl && now() < previous.validUntil) {
        if (priority === "auto") previous.image.fetchPriority = "auto";
        return;
      }
      if (previous) { entries.delete(grant.assetId); dispose(previous); }
      const validUntil = Math.min(grant.reuseUntil, grant.expiresAt - 30_000);
      if (now() >= validUntil) return;
      const image = createImage();
      image.fetchPriority = priority;
      image.alt = ""; image.setAttribute("aria-hidden", "true"); image.decoding = "async";
      const entry: Thumbnail = { image, url: grant.thumbnailUrl, validUntil, state: "loading" };
      entries.set(grant.assetId, entry);
      const finish = (state: "ready" | "failed") => {
        if (entry.state !== "loading" || entries.get(grant.assetId) !== entry) return;
        if (now() >= entry.validUntil) {
          entries.delete(grant.assetId); dispose(entry); onChange(); return;
        }
        entry.state = state; image.onload = null; image.onerror = null; onChange();
      };
      image.onerror = () => finish("failed");
      if (typeof image.decode !== "function") image.onload = () => finish("ready");
      image.src = grant.thumbnailUrl;
      if (typeof image.decode === "function") void image.decode().then(() => finish("ready"), () => finish("failed"));
    },
    cancelPending(keepAssetIds: readonly string[] = []) {
      const keep = new Set(keepAssetIds);
      for (const [id, entry] of entries) if (entry.state === "loading" && !keep.has(id)) { entries.delete(id); dispose(entry); }
    },
    retainOnly(assetIds: readonly string[]) {
      const keep = new Set(assetIds);
      let changed = false;
      for (const [id, entry] of entries) if (!keep.has(id)) {
        entries.delete(id); dispose(entry); changed = true;
      }
      if (changed) onChange();
    },
    clear() {
      const previous = [...entries.values()]; entries.clear();
      for (const entry of previous) dispose(entry);
      return previous.length > 0;
    },
  };
}

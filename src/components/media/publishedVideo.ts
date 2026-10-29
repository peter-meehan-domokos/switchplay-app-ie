import type { CloudflareStreamVideoMediaItem } from "@/lib/media";
export type VideoLoadGuard = ((media: CloudflareStreamVideoMediaItem, signal: AbortSignal) => Promise<void>) & {
  prepare?: (media: CloudflareStreamVideoMediaItem, signal: AbortSignal) => Promise<void>;
};
// Scoped to one canonical version. Background preparation checks once; only
// selected playback polls processing assets. No shared personal cache.
export function publishedVideoGuard(kind: "card" | "deck", templateId: string, version: number): VideoLoadGuard {
  const ready = new Set<string>();
  const preparing = new Map<string, { promise: Promise<"ready" | "processing" | "failed">; signal: AbortSignal }>();
  const readStatus = async (media: CloudflareStreamVideoMediaItem, signal: AbortSignal) => {
    const query = new URLSearchParams({ kind, templateId, version: String(version), assetId: media.assetId });
    const response = await fetch(`/api/library/media/stream-status?${query}`, { signal, cache: "no-store" });
    if (!response.ok) throw new Error("Published video status unavailable");
    const status = await response.json() as { status: "ready" | "processing" | "failed" };
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    if (status.status === "ready") ready.add(media.assetId);
    return status.status;
  };
  const guard: VideoLoadGuard = async (media, signal) => {
    if (ready.has(media.assetId)) return;
    while (!signal.aborted) {
      const prepared = preparing.get(media.assetId);
      const status = prepared && !prepared.signal.aborted
        ? await prepared.promise.catch(() => {
          if (signal.aborted) throw new DOMException("Aborted", "AbortError");
          return readStatus(media, signal);
        }) : await readStatus(media, signal);
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      if (status === "ready") return;
      if (status !== "processing") throw new Error("Published video unavailable");
      await new Promise<void>((resolve, reject) => {
        const cancel = () => { clearTimeout(timer); reject(new DOMException("Aborted", "AbortError")); };
        const timer = setTimeout(() => { signal.removeEventListener("abort", cancel); resolve(); }, 2000);
        signal.addEventListener("abort", cancel, { once: true });
        if (signal.aborted) cancel();
      });
    }
    throw new DOMException("Aborted", "AbortError");
  };
  // One background check only. Processing videos poll only when selected.
  guard.prepare = async (media, signal) => {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    if (ready.has(media.assetId)) return;
    const existing = preparing.get(media.assetId);
    if (existing && !existing.signal.aborted) { await existing.promise; return; }
    const entry = { signal, promise: readStatus(media, signal).finally(() => {
      if (preparing.get(media.assetId) === entry) preparing.delete(media.assetId);
    }) };
    preparing.set(media.assetId, entry);
    await entry.promise;
  };
  return guard;
}

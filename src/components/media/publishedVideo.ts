import type { CloudflareStreamVideoMediaItem } from "@/lib/media";
export type VideoLoadGuard = (media: CloudflareStreamVideoMediaItem, signal: AbortSignal) => Promise<void>;
// Created only for a selected canonical version. No mount-time requests or shared
// personal cache. Polling lives only as long as this playback request does.
export function publishedVideoGuard(kind: "card" | "deck", templateId: string, version: number): VideoLoadGuard {
  const ready = new Set<string>();
  return async (media, signal) => {
    if (ready.has(media.assetId)) return;
    while (!signal.aborted) {
      const query = new URLSearchParams({ kind, templateId, version: String(version), assetId: media.assetId });
      const response = await fetch(`/api/library/media/stream-status?${query}`, { signal, cache: "no-store" });
      if (!response.ok) throw new Error("Published video status unavailable");
      const status = await response.json() as { status: "ready" | "processing" | "failed" };
      if (status.status === "ready") { ready.add(media.assetId); return; }
      if (status.status !== "processing") throw new Error("Published video unavailable");
      await new Promise<void>((resolve, reject) => {
        const cancel = () => { clearTimeout(timer); reject(new DOMException("Aborted", "AbortError")); };
        const timer = setTimeout(() => { signal.removeEventListener("abort", cancel); resolve(); }, 2000);
        signal.addEventListener("abort", cancel, { once: true });
        if (signal.aborted) cancel();
      });
    }
    throw new DOMException("Aborted", "AbortError");
  };
}

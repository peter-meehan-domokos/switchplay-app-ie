import { instructionalImageUrl, type InstructionalImageContext } from "./instructionalImageContext";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_RETAINED_BYTES = 12 * 1024 * 1024;
const raster = new Set(["image/avif", "image/gif", "image/jpeg", "image/png", "image/webp"]);
type Entry = { controller: AbortController; promise: Promise<string>; users: number; url?: string; bytes: number };

/** Owned by one mounted actor/Card/version. No persistent browser cache or raw
 * provider URLs. Active images hold leases; idle images are bounded and revoked. */
export function createInstructionalImageResources(actor: string | undefined, options: {
  fetcher?: typeof fetch; createUrl?: (blob: Blob) => string; revokeUrl?: (url: string) => void;
  owner?: Pick<InstructionalImageContext, "cardTemplateId" | "version" | "mode">;
} = {}) {
  const entries = new Map<string, Entry>();
  const fetcher = options.fetcher ?? fetch, createUrl = options.createUrl ?? (blob => URL.createObjectURL(blob));
  const revokeUrl = options.revokeUrl ?? (url => URL.revokeObjectURL(url));
  function remove(key: string, entry: Entry) {
    if (entries.get(key) !== entry) return;
    entries.delete(key); entry.controller.abort(); if (entry.url) revokeUrl(entry.url);
  }
  function trim() {
    let bytes = [...entries.values()].reduce((sum, entry) => sum + entry.bytes, 0);
    for (const [key, entry] of entries) {
      if (entries.size <= 2 && bytes <= MAX_RETAINED_BYTES) break;
      if (entry.users) continue;
      bytes -= entry.bytes; remove(key, entry);
    }
  }
  function acquire(context: InstructionalImageContext) {
    if (!actor || context.viewerUserId !== actor) throw new Error("Instructional image actor mismatch");
    if (options.owner && (context.cardTemplateId !== options.owner.cardTemplateId || context.version !== options.owner.version || context.mode !== options.owner.mode)) throw new Error("Instructional image Card mismatch");
    const key = instructionalImageUrl(context);
    let entry = entries.get(key);
    if (!entry) {
      trim();
      if (entries.size >= 4) throw new Error("Instructional image resource limit");
      const controller = new AbortController();
      const created: Entry = { controller, users: 0, bytes: 0, promise: Promise.resolve("") };
      entries.set(key, created); entry = created;
      created.promise = (async () => {
        const timer = setTimeout(() => controller.abort(), 20_000);
        try {
          const response = await fetcher(key, { credentials: "same-origin", cache: "no-store", redirect: "error", signal: controller.signal });
          const type = response.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase();
          if (!response.ok || !type || !raster.has(type) || !response.body) { await response.body?.cancel(); throw new Error("Instructional image unavailable"); }
          const reader = response.body.getReader(), parts: Uint8Array<ArrayBuffer>[] = [];
          let bytes = 0;
          try {
            while (true) {
              const part = await reader.read(); if (part.done) break;
              bytes += part.value.byteLength;
              if (bytes > MAX_IMAGE_BYTES || controller.signal.aborted) throw new Error("Instructional image size or cancellation");
              parts.push(new Uint8Array(part.value));
            }
          } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
          if (!bytes || controller.signal.aborted || entries.get(key) !== created) throw new Error("Instructional image cancelled");
          created.bytes = bytes; created.url = createUrl(new Blob(parts, { type }));
          trim(); return created.url;
        } catch (error) { remove(key, created); throw error; }
        finally { clearTimeout(timer); }
      })();
    }
    entry.users += 1;
    // Touch for least-recently-used idle eviction.
    entries.delete(key); entries.set(key, entry);
    const owned = entry; let released = false;
    return { ready: owned.promise, release: () => {
      if (released) return; released = true; owned.users -= 1;
      if (!owned.users && !owned.url) remove(key, owned);
      trim();
    } };
  }
  return { acquire,
    discard: (context: InstructionalImageContext) => {
      if (context.viewerUserId !== actor) return;
      const key = instructionalImageUrl(context), entry = entries.get(key); if (entry) remove(key, entry);
    },
    clear: () => { for (const [key, entry] of entries) remove(key, entry); } };
}
export type InstructionalImageResources = ReturnType<typeof createInstructionalImageResources>;

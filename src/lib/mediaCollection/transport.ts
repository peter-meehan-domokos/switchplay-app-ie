import { collectionKey, type MediaCollectionContext, type MediaCollectionItem, type MediaCollectionPage } from "./contracts";
export async function mediaJson<T>(context: Pick<MediaCollectionContext, "viewerUserId">, url: string, method = "GET", body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { method, cache: "no-store", signal, headers: { "X-Personal-Viewer": context.viewerUserId, "X-Group-Viewer": context.viewerUserId,
    ...(body === undefined ? {} : { "Content-Type": "application/json" }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const value = await response.json();
  if (!response.ok) throw Object.assign(new Error(value.error ?? "Media unavailable."), { status: response.status, code: value.code, contributionId: value.contributionId });
  const viewer = response.headers.get("X-Group-Viewer") ?? response.headers.get("X-Personal-Viewer");
  if (viewer && viewer !== context.viewerUserId) throw Error("Your account changed. Reopen the Card.");
  return value;
}
export async function fetchMediaCollection(context: MediaCollectionContext, cursor?: string, signal?: AbortSignal, limit = 30): Promise<MediaCollectionPage> {
  if (context.kind === "owner") return mediaJson(context, `/api/media/history?${new URLSearchParams({ cardTemplateId: context.cardTemplateId,
    ...(context.experienceId ? { experienceId: context.experienceId } : {}), ...(cursor ? { cursor } : {}), limit: String(limit) })}`, "GET", undefined, signal);
  // Reuse the Phase 6 foreign feed. Its next cursor is an opaque exact-context
  // cursor; newer-page navigation retains cursor identities, never old payloads.
  const parsed: { after?: string; before?: string } = cursor ? JSON.parse(cursor) : {};
  const url = `/api/group-experiences/${encodeURIComponent(context.experienceId)}/cards/${encodeURIComponent(context.cardTemplateId)}/media?${new URLSearchParams({ limit: String(limit), ...(parsed.after ? { after: parsed.after } : {}), ...(parsed.before ? { before: parsed.before } : {}), ...(context.subjectUserId ? { subjectUserId: context.subjectUserId } : {}) })}`;
  const page = await mediaJson<{ capabilities: import("./permissions").MediaCapabilities; viewerUserId: string; cardTemplateId: string; experienceId: string; subjectUserId: string | null; accessEpoch: number; adoptionRevision: number; structureRevision: number; total: number; start: number; next: string | null; previous: string | null; refresh: string | null;
    items: { contributionId: string; experienceId: string; authorUserId: string; kind: "image" | "video"; revision: number; uploadedAt: string; originName: string | null }[] }>(context, url, "GET", undefined, signal);
  const items: MediaCollectionItem[] = page.items.map(i => ({ source: { kind: "group" as const, contributionId: i.contributionId, experienceId: i.experienceId },
    authorUserId: i.authorUserId, mediaType: i.kind, description: `Group ${i.kind}`, revision: i.revision, uploadedAt: i.uploadedAt, originName: i.originName, private: false })).reverse();
  return { ...page, items, start: page.start, olderCount: Math.max(0, page.total - items.length),
    older: page.next ? JSON.stringify({ after: page.next }) : null, newer: page.previous ? JSON.stringify({ before: page.previous }) : null,
    refresh: page.refresh ? JSON.stringify({ after: page.refresh }) : null };
}

// The management modal retains its existing horizontal rails. Only opening it
// requests every metadata page; thumbnails and the Gallery stay bounded.
export async function fetchMediaCentreMetadata(context: MediaCollectionContext, _cursor?: string, signal?: AbortSignal): Promise<MediaCollectionPage> {
  const first = await fetchMediaCollection(context, undefined, signal, 30);
  const items = [...first.items], cursors = new Set<string>();
  const authority = (p: MediaCollectionPage) => JSON.stringify([p.viewerUserId, p.cardTemplateId, p.experienceId, p.subjectUserId, p.accessEpoch, p.adoptionRevision, p.structureRevision]);
  let next = first.older;
  while (next) {
    if (cursors.has(next)) throw Error("Media history changed. Please reopen Media Centre.");
    cursors.add(next);
    const page = await fetchMediaCollection(context, next, signal, 30);
    if (authority(page) !== authority(first) || page.total !== first.total) throw Error("Media history changed. Please reopen Media Centre.");
    items.unshift(...page.items); next = page.older;
  }
  if (items.length !== first.total || new Set(items.map(collectionKey)).size !== items.length) throw Error("Media history changed. Please reopen Media Centre.");
  return { ...first, items, start: 0, refresh: null, olderCount: 0, older: null, newer: null };
}

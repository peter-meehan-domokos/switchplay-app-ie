import type { MediaCollectionContext, MediaCollectionItem, MediaCollectionPage } from "./contracts";
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
  const page = await mediaJson<{ viewerUserId: string; cardTemplateId: string; experienceId: string; subjectUserId: string | null; accessEpoch: number; adoptionRevision: number; structureRevision: number; total: number; start: number; next: string | null; previous: string | null; refresh: string | null;
    items: { contributionId: string; experienceId: string; authorUserId: string; kind: "image" | "video"; revision: number; uploadedAt: string; originName: string | null }[] }>(context, url, "GET", undefined, signal);
  const items: MediaCollectionItem[] = page.items.map(i => ({ source: { kind: "group" as const, contributionId: i.contributionId, experienceId: i.experienceId },
    authorUserId: i.authorUserId, mediaType: i.kind, description: `Group ${i.kind}`, revision: i.revision, uploadedAt: i.uploadedAt, originName: i.originName, private: false })).reverse();
  return { ...page, items, start: page.start, olderCount: Math.max(0, page.total - items.length),
    older: page.next ? JSON.stringify({ after: page.next }) : null, newer: page.previous ? JSON.stringify({ before: page.previous }) : null,
    refresh: page.refresh ? JSON.stringify({ after: page.refresh }) : null };
}

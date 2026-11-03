import type { GroupMediaRepository } from "../groupExperiences/media/repository";
import type { MediaAuthority } from "../groupExperiences/media/model";
import { requireCondition } from "../cards/domain";
// Same-origin encoded-video delivery for the existing iPhone share/download
// component. A grant is not sufficient: revalidate visibility after byte fetch.
export async function groupMediaVideoFile(repo: GroupMediaRepository, actor: string, id: string, authority: MediaAuthority, request: Request, fetcher: typeof fetch = fetch) {
  const initial = await repo.authorized(actor, id, authority);
  requireCondition(initial.row.kind === "video", "GROUP_MEDIA_FORBIDDEN");
  const response = await repo.deliver(actor, id, authority, "download", request.signal), download = await response.json();
  requireCondition(download.status === "ready" && typeof download.filename === "string" && /^[a-zA-Z0-9_.-]+$/.test(download.filename), "GROUP_MEDIA_NOT_READY");
  const url = new URL(download.url);
  requireCondition(url.protocol === "https:" && (url.hostname === "videodelivery.net" || url.hostname.endsWith(".cloudflarestream.com")) && url.pathname.endsWith("/downloads/default.mp4"), "GROUP_MEDIA_FORBIDDEN");
  const range = request.headers.get("range"), upstream = await fetcher(url, { cache: "no-store", signal: AbortSignal.any([request.signal, AbortSignal.timeout(20000)]),
    headers: { Origin: new URL(request.url).origin, ...(range ? { Range: range } : {}) } });
  try {
    requireCondition(upstream.ok && upstream.body && /^(video\/mp4|application\/octet-stream)(;|$)/i.test(upstream.headers.get("content-type") ?? "video/mp4"), "GROUP_MEDIA_DOWNLOAD_UNAVAILABLE");
    const latest = await repo.authorized(actor, id, authority);
    requireCondition(latest.row.revision === initial.row.revision, "GROUP_MEDIA_REVISION_CONFLICT");
    const headers = new Headers({ "Content-Type": "video/mp4", "Content-Disposition": `attachment; filename="${download.filename}"`, "Cache-Control": "private, no-store", Vary: "Cookie", "X-Group-Viewer": actor, "X-Content-Type-Options": "nosniff" });
    for (const key of ["content-length", "content-range", "accept-ranges"]) if (upstream.headers.has(key)) headers.set(key, upstream.headers.get(key)!);
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch (error) { await upstream.body?.cancel(); throw error; }
}

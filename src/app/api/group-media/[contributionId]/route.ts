import { requireCondition } from "@/lib/cards/domain";
import { mediaRequest, mediaAuthority } from "@/lib/groupExperiences/media/http";
export const runtime = "nodejs";
type Context = { params: Promise<{ contributionId: string }> };
async function read(request: Request, context: Context) {
  // Parsing happens inside the common error boundary; presence selects only
  // the operational gate and can never grant Group authority.
  return mediaRequest(request, new URL(request.url).searchParams.has("experienceId"), async (repo, actor) => {
    const { authority, action } = mediaAuthority(request), { contributionId } = await context.params;
    if (action === "thumbnail") {
      requireCondition((await repo.authorized(actor, contributionId, authority)).row.kind === "video", "GROUP_MEDIA_FORBIDDEN");
      const result = await repo.deliver(actor, contributionId, authority, "playback", request.signal), value = await result.json();
      const url = new URL(value.grant?.thumbnailUrl ?? "");
      requireCondition(url.origin === "https://videodelivery.net" && url.pathname.endsWith("/thumbnails/thumbnail.jpg"), "GROUP_MEDIA_FORBIDDEN");
      return new Response(null, { status: 302, headers: { Location: url.toString(), "X-Group-Viewer": actor, "Referrer-Policy": "no-referrer" } });
    }
    return action === "status" ? repo.status(actor, contributionId, authority)
      : repo.deliver(actor, contributionId, authority, action, request.signal);
  });
}
export const GET = read;
export const POST = read;
export async function DELETE(request: Request, context: Context) {
  return mediaRequest(request, false, async (repo, actor) => repo.delete(actor, (await context.params).contributionId, await request.json()));
}

import { CardMediaAccessError, readCardMediaRequest, resolveAccessibleCardMedia } from "@/lib/cardMediaAccess";
import { getCardMediaDownload, mediaDownloadFilename } from "@/lib/cardMediaDownloads";
import { cardMediaFileUrl } from "@/lib/cardMediaViewer";
import { CloudflareStreamApiError, CloudflareStreamConfigError, getCloudflareStreamVideoStatus } from "@/lib/cloudflareStream";
import { CloudflareR2ConfigError } from "@/lib/cloudflareR2";

const dependencies = { currentUser: async () => (await import("@/lib/auth")).getCurrentUser(), resolveMedia: resolveAccessibleCardMedia, download: getCardMediaDownload, videoStatus: getCloudflareStreamVideoStatus };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

// Injected dependencies allow authorization + provider behavior to be tested without real assets.
export function createCardMediaHandler(deps = dependencies) {
  return async function handle(request: Request) {
    try {
      const user = await deps.currentUser();
      if (!user) return json({ error: "Sign in again to access this media." }, 401);
      const prepare = request.method === "POST";
      const url = new URL(request.url);
      if (prepare && (request.headers.get("sec-fetch-site") === "cross-site" ||
        (request.headers.has("origin") && request.headers.get("origin") !== url.origin))) return json({ error: "Invalid request origin." }, 403);
      if (prepare && !request.headers.get("content-type")?.startsWith("application/json")) return json({ error: "Expected JSON." }, 415);
      const params = Object.fromEntries(url.searchParams);
      const action = prepare ? "download" : params.action;
      delete params.action;
      if (action !== "playback" && action !== "download") return json({ error: "Invalid media action." }, 400);
      const target = readCardMediaRequest(prepare ? await request.json().catch(() => null) : params);
      const item = await deps.resolveMedia(user, target);
      if (action === "playback") {
        if (item.mediaType !== "video") return json({ error: "This item is not a video." }, 400);
        return json(await deps.videoStatus(item.assetId));
      }
      if (item.mediaType === "image") return json({ status: "ready", url: cardMediaFileUrl(target), filename: mediaDownloadFilename(item) });
      return json(await deps.download(item, prepare));
    } catch (error) {
      if (error instanceof CardMediaAccessError) return json({ error: error.message }, error.status);
      if (error instanceof CloudflareStreamConfigError || error instanceof CloudflareR2ConfigError) return json({ error: error.message }, 503);
      if (error instanceof CloudflareStreamApiError && (error.status === 401 || error.status === 403)) {
        return json({ error: "Cloudflare Stream denied this request. Check the server API token's Stream read/edit permissions." }, 503);
      }
      if (error instanceof CloudflareStreamApiError && error.status === 404) return json({ error: "The video is no longer available." }, 404);
      console.error("Unable to access card media", error);
      return json({ error: "Media is temporarily unavailable. Please retry." }, 502);
    }
  };
}

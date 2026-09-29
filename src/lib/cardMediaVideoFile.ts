import { CardMediaAccessError, readCardMediaRequest, resolveAccessibleCardMedia } from "@/lib/cardMediaAccess";
import { getCardMediaDownload } from "@/lib/cardMediaDownloads";

const dependencies = {
  currentUser: async () => (await import("@/lib/auth")).getCurrentUser(),
  resolveMedia: resolveAccessibleCardMedia,
  download: getCardMediaDownload,
  fetchVideo: fetch,
};

const errorResponse = (message: string, status: number, diagnosticHeaders?: Headers) => Response.json({ error: message }, {
  status, headers: diagnosticHeaders ?? { "Cache-Control": "private, no-store" },
});

function upstreamDiagnostics(upstream: Response) {
  const headers = new Headers({ "Cache-Control": "private, no-store" });
  headers.set("X-Media-Upstream-URL", upstream.url);
  headers.set("X-Media-Upstream-Status", String(upstream.status));
  headers.set("X-Media-Upstream-Content-Type", upstream.headers.get("content-type") ?? "");
  headers.set("X-Media-Upstream-Content-Length", upstream.headers.get("content-length") ?? "");
  headers.set("X-Media-Upstream-Allow-Origin", upstream.headers.get("access-control-allow-origin") ?? "");
  return headers;
}

// Safari fetches this authorized same-origin stream if a direct Cloudflare fetch fails.
// The same route also supplies an attachment download fallback without exposing API tokens.
export function createCardMediaVideoFileHandler(deps = dependencies) {
  return async function GET(request: Request) {
    try {
      const user = await deps.currentUser();
      if (!user) return errorResponse("Sign in again to access this media.", 401);
      const target = readCardMediaRequest(Object.fromEntries(new URL(request.url).searchParams));
      const item = await deps.resolveMedia(user, target);
      if (item.mediaType !== "video") return errorResponse("This item is not a video.", 400);
      const download = await deps.download(item, false);
      if (download.status !== "ready") return errorResponse("The video download is not ready yet. Please retry.", 409);
      const url = new URL(download.url);
      if (url.protocol !== "https:" || !(url.hostname === "videodelivery.net" || url.hostname.endsWith(".cloudflarestream.com")) ||
        !url.pathname.endsWith("/downloads/default.mp4")) return errorResponse("Invalid video delivery URL.", 502);
      const range = request.headers.get("range");
      const upstream = await deps.fetchVideo(url, {
        signal: request.signal, cache: "no-store", headers: {
          Origin: new URL(request.url).origin,
          ...(range ? { Range: range } : {}),
        },
      });
      const diagnosticHeaders = upstreamDiagnostics(upstream);
      if (!upstream.ok || !upstream.body) {
        await upstream.body?.cancel();
        return errorResponse("Cloudflare could not deliver this video. Please retry.", upstream.status === 404 ? 404 : 502, diagnosticHeaders);
      }
      const contentType = upstream.headers.get("content-type") ?? "";
      if (contentType && !/^video\/mp4(?:;|$)|^application\/octet-stream(?:;|$)/i.test(contentType)) {
        await upstream.body.cancel();
        return errorResponse("Cloudflare returned a non-video response.", 502, diagnosticHeaders);
      }
      const headers = new Headers(diagnosticHeaders);
      Object.entries({
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="${download.filename}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      }).forEach(([name, value]) => headers.set(name, value));
      for (const name of ["content-length", "content-range", "accept-ranges"] as const) {
        const value = upstream.headers.get(name);
        if (value) headers.set(name, value);
      }
      return new Response(upstream.body, { status: upstream.status, headers });
    } catch (error) {
      if (error instanceof CardMediaAccessError) return errorResponse(error.message, error.status);
      console.error("Unable to deliver card video", error);
      return errorResponse("The video could not be delivered. Please retry.", 502);
    }
  };
}

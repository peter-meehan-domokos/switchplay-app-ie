import { CardMediaAccessError, readCardMediaRequest, resolveAccessibleCardMedia } from "@/lib/cardMediaAccess";
import { readProtectedImage } from "@/lib/cards/protectedMedia";
import { mediaDownloadFilename } from "@/lib/cardMediaDownloads";
import { CloudflareR2ConfigError } from "@/lib/cloudflareR2";

const dependencies = {
  currentUser: async () => (await import("@/lib/auth")).getCurrentUser(),
  resolveMedia: resolveAccessibleCardMedia,
  readImage: readProtectedImage,
};

const errorResponse = (message: string, status: number) => Response.json({ error: message }, {
  status, headers: { "Cache-Control": "private, no-store", "Vary": "Cookie" },
});

// Stream images through an authenticated same-origin response so that the
// attachment header is reliable even if R2 ignores a signed URL header override.
export function createCardMediaFileHandler(deps = dependencies) {
  return async function GET(request: Request) {
    try {
      const user = await deps.currentUser();
      if (!user) return errorResponse("Sign in again to access this media.", 401);
      const query = new URL(request.url).searchParams;
      if ([...query.keys()].some(key => query.getAll(key).length !== 1)) return errorResponse("Invalid media query.", 400);
      const target = readCardMediaRequest(Object.fromEntries(query));
      const item = await deps.resolveMedia(user, target);
      if (item.mediaType !== "image") return errorResponse("This item is not an image.", 400);
      const filename = mediaDownloadFilename(item);
      const upstream = await deps.readImage(item, request.signal);
      if (upstream.status === 403) return errorResponse("R2 denied access to this image. Check the server R2 read permissions.", 503);
      if (!upstream.ok || !upstream.body) return errorResponse("The image could not be downloaded. Please retry.", upstream.status === 404 ? 404 : 502);
      return new Response(upstream.body, { headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "application/octet-stream",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
        "Vary": "Cookie",
        "X-Content-Type-Options": "nosniff",
      } });
    } catch (error) {
      if (error instanceof CardMediaAccessError) return errorResponse(error.message, error.status);
      if (error instanceof CloudflareR2ConfigError) return errorResponse(error.message, 503);
      console.error("Unable to download card image", error instanceof Error ? error.name : "Provider failure");
      return errorResponse("The image could not be downloaded. Please retry.", 502);
    }
  };
}

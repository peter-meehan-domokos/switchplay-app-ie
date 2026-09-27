import { CardMediaAccessError, readCardMediaRequest, resolveAccessibleCardMedia } from "@/lib/cardMediaAccess";
import { mediaDownloadFilename } from "@/lib/cardMediaDownloads";
import { CloudflareR2ConfigError, createUserCardImageDownloadUrl } from "@/lib/cloudflareR2";

const dependencies = {
  currentUser: async () => (await import("@/lib/auth")).getCurrentUser(),
  resolveMedia: resolveAccessibleCardMedia,
  signedUrl: createUserCardImageDownloadUrl,
  fetchImage: fetch,
};

const errorResponse = (message: string, status: number) => Response.json({ error: message }, {
  status, headers: { "Cache-Control": "private, no-store" },
});

// Stream images through an authenticated same-origin response so that the
// attachment header is reliable even if R2 ignores a signed URL header override.
export function createCardMediaFileHandler(deps = dependencies) {
  return async function GET(request: Request) {
    try {
      const user = await deps.currentUser();
      if (!user) return errorResponse("Sign in again to access this media.", 401);
      const target = readCardMediaRequest(Object.fromEntries(new URL(request.url).searchParams));
      const item = await deps.resolveMedia(user, target);
      if (item.mediaType !== "image") return errorResponse("This item is not an image.", 400);
      const filename = mediaDownloadFilename(item);
      const signedUrl = await deps.signedUrl(item.assetId);
      const upstream = await deps.fetchImage(signedUrl, { signal: request.signal, cache: "no-store" });
      if (upstream.status === 403) return errorResponse("R2 denied access to this image. Check the server R2 read permissions.", 503);
      if (!upstream.ok || !upstream.body) return errorResponse("The image could not be downloaded. Please retry.", upstream.status === 404 ? 404 : 502);
      const extension = item.assetId.split(".").at(-1)?.toLowerCase();
      const contentType = ({ avif: "image/avif", gif: "image/gif", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" } as Record<string, string>)[extension ?? ""];
      return new Response(upstream.body, { headers: {
        "Content-Type": contentType ?? "application/octet-stream",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      } });
    } catch (error) {
      if (error instanceof CardMediaAccessError) return errorResponse(error.message, error.status);
      if (error instanceof CloudflareR2ConfigError) return errorResponse(error.message, 503);
      console.error("Unable to download card image", error);
      return errorResponse("The image could not be downloaded. Please retry.", 502);
    }
  };
}

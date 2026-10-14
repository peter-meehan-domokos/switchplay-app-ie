import { getCurrentUser } from "@/lib/auth";
import { CardRepository } from "@/lib/cards/repository";
import { CardArchitectureError, requireCondition } from "@/lib/cards/domain";
import { authorizeProtectedMedia, readProtectedImage, streamTokenUrl } from "@/lib/cards/protectedMedia";

export const runtime = "nodejs";
export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store", "Vary": "Cookie" };
  try {
    requireCondition(process.env.NEXT_PUBLIC_SWITCHPLAY_PROTECTED_MEDIA === "1", "PROTECTED_MEDIA_NOT_ENABLED");
    const user = await getCurrentUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401, headers });
    const query = new URL(request.url).searchParams;
    requireCondition([...query.keys()].every((key) => ["provider", "identity", "format", "controls", "muted"].includes(key) && query.getAll(key).length === 1), "INVALID_MEDIA_QUERY");
    const provider = query.get("provider"), format = query.get("format");
    requireCondition(provider === "r2" && format === "image" || provider === "stream" && ["manifest", "thumbnail", "iframe"].includes(format ?? ""), "INVALID_MEDIA_QUERY");
    const item = await authorizeProtectedMedia(await CardRepository.application(), user.id, provider as "r2" | "stream", query.get("identity") ?? "");
    if (provider === "r2") return await readProtectedImage(item);
    const location = new URL(await streamTokenUrl(query.get("identity")!, format as "manifest" | "thumbnail" | "iframe"));
    if (format === "iframe") for (const key of ["controls", "muted"]) if (["true", "false"].includes(query.get(key) ?? "")) location.searchParams.set(key, query.get(key)!);
    return new Response(null, { status: 302, headers: { ...headers, Location: location.toString(), "Referrer-Policy": "no-referrer" } });
  } catch (error) {
    const denied = error instanceof CardArchitectureError && error.code === "MEDIA_FORBIDDEN";
    console.error("Protected media failed", error instanceof CardArchitectureError ? error.code : "PROVIDER_OR_CONFIGURATION_FAILURE");
    return Response.json({ error: denied ? "Media unavailable" : "Media could not be loaded" }, { status: denied ? 403 : 503, headers });
  }
}

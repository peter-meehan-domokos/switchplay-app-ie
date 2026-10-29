import { libraryQuery, libraryRequest } from "@/lib/cards/libraryHttp";
import { requireCondition } from "@/lib/cards/domain";
import { authorizeLibraryVideo } from "@/lib/cards/libraryMedia";
import { videoStatus } from "@/lib/cards/mediaProviders";
export function GET(request: Request) {
  return libraryRequest(async (repo, actor) => {
    const query = libraryQuery(request, ["kind", "templateId", "version", "assetId"]);
    requireCondition([...query.keys()].every((key) => query.getAll(key).length === 1)
      && (query.get("kind") === "card" || query.get("kind") === "deck") && /^\d+$/.test(query.get("version") ?? ""), "INVALID_LIBRARY_MEDIA_CONTEXT");
    const context = { kind: query.get("kind") as "card" | "deck", templateId: query.get("templateId") ?? "", version: Number(query.get("version")), assetId: query.get("assetId") ?? "" };
    await authorizeLibraryVideo(repo, actor, context);
    return videoStatus(context.assetId);
  });
}

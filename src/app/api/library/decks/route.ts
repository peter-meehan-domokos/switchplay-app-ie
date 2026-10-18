import { libraryCollection } from "@/lib/cards/libraryReadModels";
import { libraryQuery, libraryRequest } from "@/lib/cards/libraryHttp";
import { requireCondition } from "@/lib/cards/domain";

export function GET(request: Request) {
  return libraryRequest((repo, actor) => {
    const query = libraryQuery(request, ["limit", "cursor"]);
    requireCondition(query.getAll("limit").length <= 1 && query.getAll("cursor").length <= 1, "INVALID_LIBRARY_QUERY");
    const limit = query.get("limit");
    requireCondition(limit === null || /^\d+$/.test(limit), "INVALID_LIBRARY_LIMIT");
    return libraryCollection(repo, actor, { ...(limit !== null ? { limit: Number(limit) } : {}),
      ...(query.has("cursor") ? { cursor: query.get("cursor")! } : {}) });
  });
}

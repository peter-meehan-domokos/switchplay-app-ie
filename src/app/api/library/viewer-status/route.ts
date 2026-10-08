import { libraryViewerStatus } from "@/lib/cards/libraryReadModels";
import { libraryQuery, libraryRequest } from "@/lib/cards/libraryHttp";

export function GET(request: Request) {
  return libraryRequest((repo, actor) => {
    const query = libraryQuery(request, ["deckTemplateId", "cardTemplateId"]);
    return libraryViewerStatus(repo, actor, { deckTemplateIds: query.getAll("deckTemplateId"), cardTemplateIds: query.getAll("cardTemplateId") });
  });
}

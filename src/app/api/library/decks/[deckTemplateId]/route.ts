import { libraryDetail } from "@/lib/cards/libraryReadModels";
import { libraryQuery, libraryRequest } from "@/lib/cards/libraryHttp";

export function GET(request: Request, context: RouteContext<'/api/library/decks/[deckTemplateId]'>) {
  return libraryRequest(async (repo, actor) => {
    // Latest-public only: callers cannot request an owner/private historical mode.
    libraryQuery(request, []);
    return libraryDetail(repo, actor, (await context.params).deckTemplateId);
  });
}

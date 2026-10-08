import { libraryRequest } from "@/lib/cards/libraryHttp";
import { fields } from "@/lib/cards/http";

export async function POST(request: Request, context: RouteContext<'/api/library/decks/[deckTemplateId]/restore'>) {
  return libraryRequest(async (repo, actor) => {
    const body = await request.json(); fields(body, ["membershipRevision"]);
    return repo.restoreLibraryDeck(actor, (await context.params).deckTemplateId, body.membershipRevision as number);
  });
}

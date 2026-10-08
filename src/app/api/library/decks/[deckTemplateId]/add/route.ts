import { libraryRequest } from "@/lib/cards/libraryHttp";
import { fields } from "@/lib/cards/http";
import { requireCondition } from "@/lib/cards/domain";
import { assertPreviewManifest } from "@/lib/cards/libraryEntry";

export async function POST(request: Request, context: RouteContext<'/api/library/decks/[deckTemplateId]/add'>) {
  return libraryRequest(async (repo, actor) => {
    const body = await request.json(); fields(body, ["manifest"]);
    assertPreviewManifest(body.manifest);
    requireCondition(body.manifest.deckTemplateId === (await context.params).deckTemplateId, "INVALID_PREVIEW_MANIFEST");
    return repo.addLibraryDeck(actor, body.manifest);
  });
}

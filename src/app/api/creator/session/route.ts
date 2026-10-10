import { creatorSessionDTO } from "@/lib/cards/creatorSession";
import { creatorRequestBoundary, fields } from "@/lib/cards/http";
import { requireCondition } from "@/lib/cards/domain";
import type { DeckContent, Visibility, CardForkSource } from "@/lib/cards/model";
export async function GET(request: Request) {
  return creatorRequestBoundary(request, async (repo, actor) => {
    const query = new URL(request.url).searchParams;
    const id = query.get("deckTemplateId") ?? "";
    return creatorSessionDTO(repo, actor, id, query.get("origin") === "my-decks" ? { kind: "my-decks", deckTemplateId: query.get("sourceDeckId") ?? id } : { kind: "library" },
      query.has("version") ? Number(query.get("version")) : undefined);
  });
}
export async function PATCH(request: Request) {
  return creatorRequestBoundary(request, async (repo, actor) => {
    const body = await request.json(); fields(body, ["deckTemplateId", "revision", "content", "visibility", "foreignCardSelections"]);
    requireCondition(typeof body.deckTemplateId === "string", "INVALID_ENTITY_ID");
    await repo.saveDeckDraft(actor, body.deckTemplateId, body.revision as number, body.content as DeckContent, body.visibility as Visibility,
      body.foreignCardSelections as CardForkSource[] | undefined);
    return creatorSessionDTO(repo, actor, body.deckTemplateId);
  });
}

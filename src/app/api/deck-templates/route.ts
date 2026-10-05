import { cardRequest, fields } from "@/lib/cards/http";
import { creatorDTO } from "@/lib/cards/readModels";
import type { CardContent, DeckContent } from "@/lib/cards/model";
export async function POST(request: Request) {
  return cardRequest(async (repo, actor) => {
    const body = await request.json(); fields(body, ["deckTemplateId", "content", "cards"]);
    await repo.createPrivateGraph(actor, body.deckTemplateId as string, body.content as DeckContent, body.cards as { cardTemplateId: string; content: CardContent }[]);
    return creatorDTO(repo, actor, body.deckTemplateId as string);
  });
}

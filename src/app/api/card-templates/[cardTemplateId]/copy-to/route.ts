import { cardRequest, fields, jsonDTO } from "@/lib/cards/http";
import { copyDestinations, type CopyCardCommand } from "@/lib/cards/cardReuse";

export async function GET(request: Request, context: RouteContext<'/api/card-templates/[cardTemplateId]/copy-to'>) {
  return cardRequest(async (repo, actor) => {
    const { cardTemplateId } = await context.params;
    return copyDestinations(repo, actor, cardTemplateId, new URL(request.url).searchParams.get("currentDeckTemplateId") ?? "");
  });
}
export async function POST(request: Request, context: RouteContext<'/api/card-templates/[cardTemplateId]/copy-to'>) {
  return cardRequest(async (repo, actor) => {
    const body = await request.json(); fields(body, ["deckTemplateId", "revision", "contentHash"]);
    const { cardTemplateId } = await context.params;
    return jsonDTO(await repo.copyOwnedCard(actor, cardTemplateId, body as CopyCardCommand));
  });
}

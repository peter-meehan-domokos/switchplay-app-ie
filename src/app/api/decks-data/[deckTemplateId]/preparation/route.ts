import { personalUpdateRequest, fields } from "@/lib/cards/http";
import { preparePersonalDeck, openPreparedPersonalDeck } from "@/lib/cards/preparation";
import { requireCondition } from "@/lib/cards/domain";
export function GET(request: Request, context: { params: Promise<{ deckTemplateId: string }> }) {
  return personalUpdateRequest(request, async (repo, actor) => preparePersonalDeck(repo, actor, (await context.params).deckTemplateId));
}
export function POST(request: Request, context: { params: Promise<{ deckTemplateId: string }> }) {
  return personalUpdateRequest(request, async (repo, actor) => {
    const body = await request.json(); fields(body, ["localDate", "cardTemplateId", "expectedCardVersion", "preparedComposition"]);
    requireCondition(body.preparedComposition === undefined || typeof body.preparedComposition === "string", "INVALID_REQUEST_FIELDS");
    const id = (await context.params).deckTemplateId;
    return openPreparedPersonalDeck(repo, actor, id, body.localDate as string, body.cardTemplateId as string | undefined, body.expectedCardVersion as number | undefined, body.preparedComposition as string | undefined);
  });
}

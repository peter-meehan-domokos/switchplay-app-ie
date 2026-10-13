import { personalUpdateRequest, fields } from "@/lib/cards/http";
import { membershipDTO, workingDTO } from "@/lib/cards/readModels";
export function GET(request: Request) { return personalUpdateRequest(request, (repo, actor) => membershipDTO(repo, actor)); }
export async function POST(request: Request) {
  return personalUpdateRequest(request, async (repo, actor) => {
    const body = await request.json(); fields(body, ["deckTemplateId", "localDate", "cardTemplateId", "expectedCardVersion"]);
    await repo.openWorkingDeck(actor, body.deckTemplateId as string, body.localDate as string, body.cardTemplateId as string | undefined, body.expectedCardVersion as number | undefined);
    return workingDTO(repo, actor, body.deckTemplateId as string);
  });
}

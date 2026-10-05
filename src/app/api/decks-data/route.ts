import { cardRequest, fields } from "@/lib/cards/http";
import { membershipDTO, workingDTO } from "@/lib/cards/readModels";
export function GET() { return cardRequest((repo, actor) => membershipDTO(repo, actor)); }
export async function POST(request: Request) {
  return cardRequest(async (repo, actor) => {
    const body = await request.json(); fields(body, ["deckTemplateId", "localDate"]);
    await repo.openWorkingDeck(actor, body.deckTemplateId as string, body.localDate as string);
    return workingDTO(repo, actor, body.deckTemplateId as string);
  });
}

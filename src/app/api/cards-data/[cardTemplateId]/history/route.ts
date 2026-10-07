import { cardRequest } from "@/lib/cards/http";
import { personalCardHistoryDTO } from "@/lib/cards/readModels";

export async function GET(_request: Request, context: RouteContext<'/api/cards-data/[cardTemplateId]/history'>) {
  return cardRequest(async (repo, actor) => personalCardHistoryDTO(repo, actor, (await context.params).cardTemplateId));
}

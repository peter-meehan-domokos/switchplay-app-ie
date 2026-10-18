import { personalUpdateRequest } from "@/lib/cards/http";
import { readItemAssessmentHistory } from "@/lib/frameworks/readModels";

export async function GET(request: Request, context: RouteContext<'/api/items-data/[itemId]/history'>) {
  const { itemId } = await context.params;
  return personalUpdateRequest(request, (repo, actor) => readItemAssessmentHistory(repo, actor, itemId));
}

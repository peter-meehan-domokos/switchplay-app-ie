import { personalUpdateRequest } from "@/lib/cards/http";
import { readCardAssessmentHistory } from "@/lib/frameworks/readModels";

export async function GET(request: Request, context: RouteContext<'/api/cards-data/[cardTemplateId]/assessment-history'>) {
  const { cardTemplateId } = await context.params;
  return personalUpdateRequest(request, (repo, actor) => readCardAssessmentHistory(repo, actor, cardTemplateId));
}

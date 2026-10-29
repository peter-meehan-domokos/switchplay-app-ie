import { personalUpdateRequest } from "@/lib/cards/http";
import { readFrameworkSummary } from "@/lib/frameworks/readModels";

export async function GET(request: Request, context: RouteContext<'/api/frameworks/[frameworkId]/summary'>) {
  const { frameworkId } = await context.params;
  return personalUpdateRequest(request, (repo, actor) => readFrameworkSummary(repo, actor, frameworkId));
}

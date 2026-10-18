import { personalUpdateRequest } from "@/lib/cards/http";
import { readFrameworkSummaries } from "@/lib/frameworks/readModels";

export async function GET(request: Request) {
  return personalUpdateRequest(request, (repo, actor) => readFrameworkSummaries(repo, actor));
}

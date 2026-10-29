import { personalUpdateRequest } from "@/lib/cards/http";
import { frameworkMetadata } from "@/lib/frameworks/readModels";

export async function GET(request: Request) {
  return personalUpdateRequest(request, async (_repo, actor) => ({ viewerUserId: actor, frameworks: frameworkMetadata() }));
}

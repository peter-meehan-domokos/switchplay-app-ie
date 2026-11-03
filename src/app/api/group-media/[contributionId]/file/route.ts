import { mediaRequest, mediaAuthority } from "@/lib/groupExperiences/media/http";
import { groupMediaVideoFile } from "@/lib/mediaCollection/videoFile";
export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ contributionId: string }> }) {
  return mediaRequest(request, new URL(request.url).searchParams.has("experienceId"), async (repo, actor) =>
    groupMediaVideoFile(repo, actor, (await context.params).contributionId, mediaAuthority(request).authority, request));
}

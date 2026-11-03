import { mediaRequest } from "@/lib/groupExperiences/media/http";
export const runtime = "nodejs";
export async function PATCH(request: Request, context: { params: Promise<{ experienceId: string; contributionId: string }> }) {
  return mediaRequest(request, true, async (repo, actor) => {
    const { experienceId, contributionId } = await context.params;
    return repo.hide(actor, experienceId, contributionId, await request.json());
  });
}

import { mediaRequest } from "@/lib/groupExperiences/media/http";
export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ experienceId: string; cardTemplateId: string; contributionId: string }> }) {
  return mediaRequest(request, true, async (repo, actor) => {
    const { experienceId, cardTemplateId, contributionId } = await context.params;
    return repo.commit(actor, experienceId, cardTemplateId, contributionId, await request.json());
  });
}

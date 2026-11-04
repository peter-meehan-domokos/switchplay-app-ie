import { mediaRequest } from "@/lib/groupExperiences/media/http";
import { mutationCommand } from "@/lib/groupExperiences/media/contracts";
export const runtime = "nodejs";
export async function PATCH(request: Request, context: { params: Promise<{ experienceId: string; contributionId: string }> }) {
  return mediaRequest(request, true, async (repo, actor) => {
    const { experienceId, contributionId } = await context.params;
    return repo.hide(actor, experienceId, contributionId, await request.json());
  });
}
export async function DELETE(request: Request, context: { params: Promise<{ experienceId: string; contributionId: string }> }) {
  return mediaRequest(request, true, async (repo, actor) => {
    const { experienceId, contributionId } = await context.params;
    const command = mutationCommand(await request.json(), "hide");
    return repo.delete(actor, contributionId, { expectedRevision: command.expectedRevision }, { experienceId, accessEpoch: command.accessEpoch! });
  });
}

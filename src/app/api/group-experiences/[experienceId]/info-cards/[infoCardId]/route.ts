import { fields } from "@/lib/cards/http";
import { infoRequest } from "@/lib/infoCards/http";

// Admin hide of a Group contribution Info Card, as Group media hiding: visibility only, never deletion.
export async function PATCH(request: Request, context: { params: Promise<{ experienceId: string; infoCardId: string }> }) {
  return infoRequest(request, async (repo, actor) => {
    const body = await request.json(); fields(body, ["accessEpoch"]);
    const { experienceId, infoCardId } = await context.params;
    return repo.hideGroup(actor, experienceId, infoCardId, body.accessEpoch);
  });
}

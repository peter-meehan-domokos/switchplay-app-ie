import { fields } from "@/lib/cards/http";
import { infoRequest } from "@/lib/infoCards/http";

// Creates a Group contribution Info Card, authorised as a Group media upload from the same perspective: a Follower
// contribution from Me (checkpoint 4.2) or an Admin contribution from the Group perspective (checkpoint 4.3).
export async function POST(request: Request, context: { params: Promise<{ experienceId: string; cardTemplateId: string }> }) {
  return infoRequest(request, async (repo, actor) => {
    const body = await request.json(); fields(body, ["infoCardId", "accessEpoch", "version", "creationContext"]);
    const { experienceId, cardTemplateId } = await context.params;
    return repo.createGroup(actor, body.infoCardId as string, experienceId, cardTemplateId,
      { accessEpoch: body.accessEpoch, version: body.version, creationContext: body.creationContext });
  });
}

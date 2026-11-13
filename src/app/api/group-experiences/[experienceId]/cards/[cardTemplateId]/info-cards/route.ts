import { fields } from "@/lib/cards/http";
import { infoRequest } from "@/lib/infoCards/http";

// Creates a Group contribution Info Card from Me (checkpoint 4.2), authorised as a Group media upload from Me.
export async function POST(request: Request, context: { params: Promise<{ experienceId: string; cardTemplateId: string }> }) {
  return infoRequest(request, async (repo, actor) => {
    const body = await request.json(); fields(body, ["infoCardId", "accessEpoch", "version", "creationContext"]);
    const { experienceId, cardTemplateId } = await context.params;
    return repo.createGroup(actor, body.infoCardId as string, experienceId, cardTemplateId,
      { accessEpoch: body.accessEpoch, version: body.version, creationContext: body.creationContext });
  });
}

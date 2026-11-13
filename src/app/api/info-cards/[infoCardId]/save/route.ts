import { fields } from "@/lib/cards/http";
import { infoRequest } from "@/lib/infoCards/http";
import type { PersonalInfoContext } from "@/lib/infoCards/model";

export async function POST(request: Request, context: { params: Promise<{ infoCardId: string }> }) {
  return infoRequest(request, async (repo, actor) => {
    const body = await request.json(); fields(body, ["revision", "context"]);
    if (body.context !== undefined) fields(body.context, ["deckTemplateId", "version", "personalInfoRevision"]);
    const id = (await context.params).infoCardId;
    const receipt = await repo.savePersonal(actor, id, body.revision as number, body.context as PersonalInfoContext | undefined);
    // Accepted, not yet saved: the video is still processing and the request is stored (checkpoint 10).
    if ("status" in receipt) return Response.json(receipt, { status: 202 });
    const association = await repo.personalAssociation(actor, id);
    return { ...receipt, ...(association ? { association } : {}) };
  });
}

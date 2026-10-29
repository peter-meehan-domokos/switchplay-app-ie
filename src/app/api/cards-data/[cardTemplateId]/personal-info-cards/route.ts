import { fields } from "@/lib/cards/http";
import { infoRequest } from "@/lib/infoCards/http";
import type { PersonalInfoContext } from "@/lib/infoCards/model";

type Context = { params: Promise<{ cardTemplateId: string }> };
export async function POST(request: Request, context: Context) {
  return infoRequest(request, async (repo, actor) => {
    const body = await request.json(); fields(body, ["infoCardId", "context"]);
    fields(body.context, ["deckTemplateId", "version", "personalInfoRevision"]);
    return repo.createPersonal(actor, body.infoCardId as string, (await context.params).cardTemplateId, body.context as PersonalInfoContext);
  });
}
export async function PATCH(request: Request, context: Context) {
  return infoRequest(request, async (repo, actor) => {
    const body = await request.json(); fields(body, ["infoCardId", "revision"]);
    return repo.removePersonal(actor, (await context.params).cardTemplateId, body.infoCardId as string, body.revision as number);
  });
}

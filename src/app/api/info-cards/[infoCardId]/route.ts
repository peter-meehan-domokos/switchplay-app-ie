import { fields } from "@/lib/cards/http";
import { infoRequest } from "@/lib/infoCards/http";
import type { InfoDraft } from "@/lib/infoCards/model";
import type { Visibility } from "@/lib/cards/model";
import { infoEditor } from "@/lib/infoCards/queries";
type Context = { params: Promise<{ infoCardId: string }> };
export async function GET(request: Request, context: Context) {
  return infoRequest(request, async (repo, actor) => infoEditor(repo, actor, (await context.params).infoCardId));
}
export async function PATCH(request: Request, context: Context) {
  return infoRequest(request, async (repo, actor) => {
    const body = await request.json(); fields(body, ["revision", "content", "visibility", "mediaProof"]);
    return repo.save(actor, (await context.params).infoCardId, body.revision as number, body.content as InfoDraft, body.visibility as Visibility, body.mediaProof as string | undefined);
  });
}
export async function DELETE(request: Request, context: Context) {
  return infoRequest(request, async (repo, actor) => {
    const body = await request.json(); fields(body, ["revision"]);
    return repo.delete(actor, (await context.params).infoCardId, body.revision as number);
  });
}

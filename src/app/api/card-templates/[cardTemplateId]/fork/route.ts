import { cardRequest, fields, jsonDTO } from "@/lib/cards/http";
import type { CardForkCommand } from "@/lib/cards/model";

// Backend foundation only; no foreign-edit UI invokes this yet.
export async function POST(request: Request, context: RouteContext<'/api/card-templates/[cardTemplateId]/fork'>) {
  return cardRequest(async (repo, actor) => {
    const body = await request.json(); fields(body, ["sourceVersion", "cardTemplateId", "stepIds", "content", "context", "attachTo"]);
    const { cardTemplateId } = await context.params;
    return jsonDTO(await repo.createCardFork(actor, { ...body,
      source: { cardTemplateId, version: body.sourceVersion } } as CardForkCommand));
  });
}

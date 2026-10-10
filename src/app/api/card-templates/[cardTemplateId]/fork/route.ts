import { creatorRequestBoundary, fields, jsonDTO } from "@/lib/cards/http";
import type { CardForkCommand } from "@/lib/cards/model";

// Frozen, actor-bound Creator first-edit command; publication remains independent.
export async function POST(request: Request, context: RouteContext<'/api/card-templates/[cardTemplateId]/fork'>) {
  return creatorRequestBoundary(request, async (repo, actor) => {
    const body = await request.json(); fields(body, ["sourceVersion", "cardTemplateId", "stepIds", "content", "context", "attachTo", "visibility", "mediaProofs"]);
    const { cardTemplateId } = await context.params;
    return jsonDTO(await repo.createCardFork(actor, { ...body,
      source: { cardTemplateId, version: body.sourceVersion } } as CardForkCommand));
  });
}

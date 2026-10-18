import { creatorRequestBoundary, fields, jsonDTO } from "@/lib/cards/http";
import { creatorCardDTO } from "@/lib/cards/readModels";
import { requireCondition } from "@/lib/cards/domain";
import type { CardContent, Visibility } from "@/lib/cards/model";

export async function GET(request: Request, context: RouteContext<'/api/card-templates/[cardTemplateId]'>) {
  return creatorRequestBoundary(request, async (repo, actor) => {
    const { cardTemplateId } = await context.params;
    const card = await creatorCardDTO(repo, actor, cardTemplateId);
    const selected = new URL(request.url).searchParams.get("version");
    if (selected !== null) {
      const version = await repo.getCardVersion(cardTemplateId, Number(selected));
      requireCondition(version && version.version <= card.root.latestVersion, "MISSING_CARD_VERSION");
      return jsonDTO(version);
    }
    return card;
  });
}

export async function PATCH(request: Request, context: RouteContext<'/api/card-templates/[cardTemplateId]'>) {
  return creatorRequestBoundary(request, async (repo, actor) => {
    const body = await request.json();
    fields(body, ["type", "revision", "content", "updateNote", "visibility"]);
    const { cardTemplateId } = await context.params;
    if (body.type === "save") await repo.saveCardDraft(actor, cardTemplateId, body.revision as number, body.content as CardContent, body.visibility as Visibility | undefined);
    else if (body.type === "publish") {
      requireCondition(body.visibility === undefined, "VISIBILITY_SAVE_REQUIRED");
      await repo.publishCard(actor, cardTemplateId, body.revision as number, body.updateNote as string | undefined);
    }
    else requireCondition(false, "INVALID_CARD_OPERATION");
    return creatorCardDTO(repo, actor, cardTemplateId);
  });
}

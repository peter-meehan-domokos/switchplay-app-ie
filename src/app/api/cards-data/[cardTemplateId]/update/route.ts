import { fields, personalUpdateRequest } from "@/lib/cards/http";
import { requireCondition } from "@/lib/cards/domain";
import { assertUpdateCommand } from "@/lib/cards/updateAdoption";

export async function GET(request: Request, context: RouteContext<'/api/cards-data/[cardTemplateId]/update'>) {
  return personalUpdateRequest(request, async (repo, actor) => repo.reviewUpdate(actor, "card", (await context.params).cardTemplateId));
}
export async function POST(request: Request, context: RouteContext<'/api/cards-data/[cardTemplateId]/update'>) {
  return personalUpdateRequest(request, async (repo, actor) => {
    const body = await request.json(); fields(body, ["command"]); assertUpdateCommand(body.command);
    requireCondition(body.command.kind === "card" && body.command.entityId === (await context.params).cardTemplateId, "INVALID_UPDATE_COMMAND");
    return repo.adoptUpdate(actor, body.command);
  });
}

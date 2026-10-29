import { fields } from "@/lib/cards/http";
import { infoRequest } from "@/lib/infoCards/http";
import type { PersonalInfoContext } from "@/lib/infoCards/model";
import { CardRepository } from "@/lib/cards/repository";

export async function POST(request: Request, context: { params: Promise<{ infoCardId: string }> }) {
  return infoRequest(request, async (repo, actor) => {
    const body = await request.json(); fields(body, ["revision", "context"]);
    if (body.context !== undefined) fields(body.context, ["deckTemplateId", "version", "personalInfoRevision"]);
    const id = (await context.params).infoCardId;
    const receipt = await repo.savePersonal(actor, id, body.revision as number, body.context as PersonalInfoContext | undefined);
    const root = await repo.owner(actor, id);
    const user = await new CardRepository(repo.db, repo.client).getPersonalUser(actor);
    const sources = user?.cardsData.filter(data => data.cardTemplateId === root.originCardTemplateId) ?? [];
    const source = sources.length === 1 ? sources[0] : null;
    return { ...receipt, ...(source ? { association: { cardTemplateId: source.cardTemplateId,
      personalInfoRevision: source.personalInfoRevision ?? 0, personalInfoCardIds: source.personalInfoCardIds ?? [],
      personalInfoCardAttachedAt: source.personalInfoCardAttachedAt ?? {} } } : {}) };
  });
}

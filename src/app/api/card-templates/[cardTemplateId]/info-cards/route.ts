import { personalUpdateRequest } from "@/lib/cards/http";
import { requireCondition } from "@/lib/cards/domain";
import { InfoCardRepository } from "@/lib/infoCards/repository";
import { mainInfoConsultation } from "@/lib/infoCards/queries";

export async function GET(request: Request, context: { params: Promise<{ cardTemplateId: string }> }) {
  return personalUpdateRequest(request, async (main, actor) => {
    const query = new URL(request.url).searchParams, mode = query.get("mode");
    requireCondition([...query.keys()].every(key => ["mode", "version", "deckTemplateId"].includes(key) && query.getAll(key).length === 1)
      && (mode === "working" || mode === "canonical") && (mode === "working" || !query.has("deckTemplateId")), "INVALID_INFO_QUERY");
    const info = new InfoCardRepository(main.db, main.client); await info.assertIndexesReady();
    return mainInfoConsultation(info, actor, (await context.params).cardTemplateId, {
      mode, version: Number(query.get("version")), ...(query.has("deckTemplateId") ? { deckTemplateId: query.get("deckTemplateId")! } : {}),
    });
  });
}

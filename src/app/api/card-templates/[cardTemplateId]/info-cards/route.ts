import { personalUpdateRequest } from "@/lib/cards/http";
import { requireCondition } from "@/lib/cards/domain";
import { InfoCardRepository } from "@/lib/infoCards/repository";
import { resumingInfoConsultation } from "@/lib/infoCards/queries";

export async function GET(request: Request, context: { params: Promise<{ cardTemplateId: string }> }) {
  return personalUpdateRequest(request, async (main, actor) => {
    const query = new URL(request.url).searchParams, mode = query.get("mode");
    // "group" is the Group perspective, or with subjectUserId the inspection of one follower (checkpoint 4.3).
    requireCondition([...query.keys()].every(key => ["mode", "version", "deckTemplateId", "experienceId", "subjectUserId"].includes(key) && query.getAll(key).length === 1)
      && (mode === "working" || mode === "canonical" || mode === "experience" || mode === "group") && (mode === "working" || !query.has("deckTemplateId"))
      && (mode === "experience" || mode === "group") === query.has("experienceId") && (mode === "group" || !query.has("subjectUserId")), "INVALID_INFO_QUERY");
    const info = new InfoCardRepository(main.db, main.client); await info.assertIndexesReady();
    return resumingInfoConsultation(info, actor, (await context.params).cardTemplateId, {
      mode, version: Number(query.get("version")), ...(query.has("deckTemplateId") ? { deckTemplateId: query.get("deckTemplateId")! } : {}),
      ...(query.has("experienceId") ? { experienceId: query.get("experienceId")! } : {}),
      ...(query.has("subjectUserId") ? { subjectUserId: query.get("subjectUserId")! } : {}),
    });
  });
}

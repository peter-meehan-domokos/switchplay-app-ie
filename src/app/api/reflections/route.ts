import { saveCollectiveReflection } from "@/lib/reflections/collective";
import { requireCondition } from "@/lib/cards/domain";
import { personalUpdateRequest } from "@/lib/cards/http";
import { GroupExperienceRepository } from "@/lib/groupExperiences/repository";
import { groupRequest, query } from "@/lib/groupExperiences/http";
import { exact, id, revision } from "@/lib/groupExperiences/contracts";
import { GroupReflectionRepository } from "@/lib/reflections/groupRepository";
import { readReflectionFeed, type ReflectionView } from "@/lib/reflections/reads";

function viewFrom(request: Request): { cardTemplateId: string; view: ReflectionView } {
  const p = query(request, ["cardTemplateId", "experienceId", "mode", "subjectUserId", "accessEpoch"]);
  const cardTemplateId = p.get("cardTemplateId")!; id(cardTemplateId);
  if (!p.has("experienceId")) {
    requireCondition([...p.keys()].every(k => k === "cardTemplateId"), "INVALID_REFLECTION_CONTEXT");
    return { cardTemplateId, view: { kind: "personal" } };
  }
  const experienceId = p.get("experienceId")!, mode = p.get("mode"), accessEpoch = Number(p.get("accessEpoch"));
  id(experienceId); requireCondition(p.has("accessEpoch"), "INVALID_REFLECTION_CONTEXT"); revision(accessEpoch);
  requireCondition(mode === "own" || mode === "group" || mode === "inspection", "INVALID_REFLECTION_CONTEXT");
  const subjectUserId = p.get("subjectUserId") ?? undefined;
  requireCondition(mode === "inspection" ? !!subjectUserId : subjectUserId === undefined, "INVALID_REFLECTION_CONTEXT");
  return { cardTemplateId, view: { kind: "group", experienceId, mode, subjectUserId, accessEpoch } };
}
export async function GET(request: Request) {
  // Parse inside the normal error boundary, including forged query parameters.
  return personalUpdateRequest(request, async (cards, actor) => {
    const { cardTemplateId, view } = viewFrom(request);
    if (view.kind === "group") {
      requireCondition(!request.headers.has("X-Group-Viewer") || request.headers.get("X-Group-Viewer") === actor, "GROUP_SESSION_CONFLICT");
    }
    return readReflectionFeed(new GroupExperienceRepository(cards), actor, cardTemplateId, view);
  });
}
export async function POST(request: Request) {
  const execute = async (groups: GroupExperienceRepository, actor: string) => {
    const origin = request.headers.get("origin"), host = request.headers.get("host") ?? new URL(request.url).host;
    requireCondition(request.headers.get("sec-fetch-site") !== "cross-site" && (!origin || new URL(origin).host === host), "REFLECTION_ORIGIN_FORBIDDEN");
    const body = await request.json();
    exact(body, ["action", "source", "text", "operationId", "expectedRevision", "accessEpoch", "deckTemplateId"]);
    requireCondition(body.action === "save" || body.action === "delete" || body.action === "hide", "INVALID_REFLECTION_ACTION");
    requireCondition(body.source !== null && typeof body.source === "object" && "kind" in body.source, "INVALID_REFLECTION_SOURCE");
    const sourceValue: unknown = body.source;
    exact(sourceValue, body.source.kind === "personal" ? ["kind", "cardTemplateId"] : body.source.kind === "group-card" ? ["kind", "cardTemplateId", "experienceId"] : ["kind", "cardTemplateId", "experienceId", "reflectionId"]);
    const source = sourceValue; id(source.cardTemplateId);
    id(body.operationId); revision(body.expectedRevision);
    const command = { operationId: body.operationId, expectedRevision: body.expectedRevision };
    if (source.kind === "group-card") {
      requireCondition(body.action === "save", "REFLECTION_SOURCE_FORBIDDEN");
      id(source.experienceId);
      return saveCollectiveReflection(groups, actor, source.experienceId, source.cardTemplateId, { ...command, accessEpoch: body.accessEpoch, text: body.text });
    }
    if (source.kind === "personal") {
      requireCondition(body.action !== "hide", "REFLECTION_SOURCE_FORBIDDEN");
      if (body.action === "save") { id(body.deckTemplateId); requireCondition(typeof body.text === "string", "INVALID_REFLECTION_TEXT"); }
      return body.action === "delete" ? groups.cards.deletePersonalReflection(actor, source.cardTemplateId, command)
        : groups.cards.setReflection(actor, body.deckTemplateId as string, source.cardTemplateId, body.text as string, command);
    }
    requireCondition(source.kind === "group", "INVALID_REFLECTION_SOURCE");
    id(source.experienceId);
    if (source.reflectionId !== null) id(source.reflectionId);
    const repo = new GroupReflectionRepository(groups);
    if (body.action === "save") {
      return repo.save(actor, source.experienceId, source.cardTemplateId, { ...command, accessEpoch: body.accessEpoch, text: body.text, reflectionId: source.reflectionId });
    }
    id(source.reflectionId);
    // Verify the complete supplied target, not just its row ID.
    const row = await repo.rows().findOne({ reflectionId: source.reflectionId, experienceId: source.experienceId, cardTemplateId: source.cardTemplateId,
      ...(body.action === "delete" ? { authorUserId: actor } : {}) }, { projection: { _id: 0, reflectionId: 1 } });
    requireCondition(row, "REFLECTION_SOURCE_FORBIDDEN");
    if (body.action === "delete") return repo.deleteOwn(actor, source.reflectionId, command);
    return repo.hide(actor, source.experienceId, source.reflectionId, { ...command, accessEpoch: body.accessEpoch });
  };
  // Creator deletion remains possible outside originating Group membership.
  return request.headers.has("X-Group-Viewer") ? groupRequest(request, execute)
    : personalUpdateRequest(request, (cards, actor) => execute(new GroupExperienceRepository(cards), actor));
}

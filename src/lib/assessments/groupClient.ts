import { enqueuePersonalMutation } from "../deckMutations";
import { personalWork } from "../cards/personalWork";
import { AssessmentConflict, assertAssessmentCommand, assertAssessmentSource, assessmentTarget, sameAssessmentSource,
  type AssessmentCommand, type AssessmentList, type AssessmentMutationResult, type AssessmentSource } from "./contracts";
import { requireCondition } from "../cards/domain";
export type GroupAssessmentContext = { experienceId: string };
const workContext = (group: GroupAssessmentContext) => ({ kind: "experience-assessment" as const, experienceId: group.experienceId });
const workKey = (source: AssessmentSource) => source.kind === "card" ? `card:${source.cardTemplateId}:tests` : "item-tests";
function listUrl(group: GroupAssessmentContext, source: AssessmentSource) {
  assertAssessmentSource(source);
  requireCondition(typeof group.experienceId === "string" && group.experienceId.trim() === group.experienceId && group.experienceId.length > 0, "INVALID_GROUP_ID");
  return `/api/group-experiences/${encodeURIComponent(group.experienceId)}/${source.kind === "card" ? `cards/${encodeURIComponent(source.cardTemplateId)}` : `items/${encodeURIComponent(source.itemId)}`}/tests`;
}
class GroupAssessmentHttpError extends Error { constructor(readonly status: number, message: string) { super(message); } }
async function responseList(response: Response, actor: string, group: GroupAssessmentContext, source: AssessmentSource): Promise<AssessmentList> {
  const body = await response.json(); requireCondition(response.headers.get("X-Group-Viewer") === actor, "GROUP_SESSION_CONFLICT");
  const validate = (value: { viewerUserId?: string; experienceId?: string; owner?: { kind?: string; experienceId?: string }; source?: AssessmentSource; target?: unknown }) => {
    requireCondition(value.viewerUserId === actor && value.experienceId === group.experienceId && value.owner?.kind === "group" && value.owner.experienceId === group.experienceId
      && value.source && sameAssessmentSource(value.source, source) && JSON.stringify(value.target) === JSON.stringify(assessmentTarget(source)), "GROUP_CONTEXT_CONFLICT");
  };
  if (!response.ok) {
    if (body.code === "ASSESSMENT_REVISION_CONFLICT" && body.latestList) { validate(body.latestList); throw new AssessmentConflict(body.latestList); }
    throw new GroupAssessmentHttpError(response.status, body.error ?? "Unable to save Group assessment.");
  }
  validate(body); requireCondition(Number.isSafeInteger(body.revision) && body.revision >= 0 && Array.isArray(body.tests), "INVALID_ASSESSMENT_RESPONSE");
  return body;
}
export async function readGroupAssessmentList(actor: string, source: AssessmentSource, group: GroupAssessmentContext) {
  return responseList(await fetch(listUrl(group, source), { headers: { "X-Group-Viewer": actor }, cache: "no-store", signal: AbortSignal.timeout(15000) }), actor, group, source);
}
export function persistGroupAssessment(input: AssessmentCommand, context: GroupAssessmentContext): Promise<AssessmentMutationResult> {
  assertAssessmentCommand(input);
  const command = structuredClone(input), group = { ...context }, actor = command.viewerUserId, source = command.source;
  const url = listUrl(group, source), key = workKey(source);
  const { source: _source, ...fields } = command; void _source;
  const body = { ...fields, target: assessmentTarget(source) }; if ("deckTemplateId" in body) delete body.deckTemplateId;
  let uncertain = false;
  const operation = () => enqueuePersonalMutation(JSON.stringify([actor, group.experienceId, "group-assessment", key]), async () => {
    // The public Group list intentionally redacts original actor/origin IDs.
    // It cannot safely confirm an Add's immutable origin. After a lost response,
    // read the captured source, then let the server reconcile the exact command.
    if (uncertain) await readGroupAssessmentList(actor, source, group);
    const wasUncertain = uncertain; uncertain = true;
    const send = async () => responseList(await fetch(command.action === "add" ? url : `${url}/${encodeURIComponent(command.id)}`, {
      method: command.action === "add" ? "POST" : command.action === "update" ? "PATCH" : "DELETE", signal: AbortSignal.timeout(15000),
      headers: { "Content-Type": "application/json", "X-Group-Viewer": actor }, body: JSON.stringify(body),
    }), actor, group, source) as Promise<AssessmentMutationResult>;
    try {
      let result: AssessmentMutationResult;
      try { result = await send(); }
      catch (error) {
        if (error instanceof AssessmentConflict || error instanceof GroupAssessmentHttpError && error.status < 500) throw error;
        await readGroupAssessmentList(actor, source, group);
        result = await send(); // Server reconciliation checks the immutable Add origin.
      }
      uncertain = false;
      if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("group-assessment-changed", { detail: { actor, experienceId: group.experienceId } }));
      return result;
    } catch (error) { if (error instanceof AssessmentConflict || !wasUncertain && error instanceof GroupAssessmentHttpError && error.status < 500) uncertain = false; throw error; }
  });
  return personalWork.run({ userId: actor, cardIds: source.kind === "card" ? [source.cardTemplateId] : [], context: workContext(group) }, key, operation);
}
export function retryGroupAssessment(command: AssessmentCommand, operation: Promise<unknown>, group: GroupAssessmentContext) {
  return personalWork.retryFailed(command.viewerUserId, workKey(command.source), operation, workContext(group)) as Promise<AssessmentMutationResult>;
}
export function discardGroupAssessment(command: AssessmentCommand, operation: Promise<unknown>, group: GroupAssessmentContext) {
  personalWork.discardFailed(command.viewerUserId, workKey(command.source), operation, workContext(group));
}

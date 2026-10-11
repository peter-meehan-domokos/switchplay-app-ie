import { enqueuePersonalMutation } from "../deckMutations";
import { personalWork } from "../cards/personalWork";
import { workingCardStore } from "../cards/workingCardStore";
import { requireCondition } from "../cards/domain";
import { AssessmentConflict, assertAssessmentCommand, sameAssessmentSource, reconcileAssessment,
  type AssessmentCommand, type AssessmentList, type AssessmentMutationResult, type AssessmentSource } from "./contracts";

function listUrl(source: AssessmentSource) {
  return source.kind === "card" ? `/api/cards-data/${encodeURIComponent(source.cardTemplateId)}/tests`
    : `/api/items-data/${encodeURIComponent(source.itemId)}/tests`;
}
class AssessmentHttpError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}
async function assessmentResponse(response: Response, actor: string, source: AssessmentSource): Promise<AssessmentList> {
  const payload = await response.json();
  requireCondition(response.headers.get("X-Personal-Viewer") === actor, "ASSESSMENT_SESSION_CONFLICT");
  if (!response.ok) {
    if (payload.code === "ASSESSMENT_REVISION_CONFLICT" && payload.latestList) throw new AssessmentConflict(payload.latestList);
    throw new AssessmentHttpError(response.status, payload.error ?? "Unable to save assessment.");
  }
  requireCondition(payload.viewerUserId === actor && payload.source && sameAssessmentSource(payload.source, source), "ASSESSMENT_SESSION_CONFLICT");
  requireCondition(Number.isSafeInteger(payload.revision) && payload.revision >= 0 && Array.isArray(payload.tests), "INVALID_ASSESSMENT_RESPONSE");
  return payload;
}
export async function readPersonalAssessments(actor: string, source: AssessmentSource) {
  return assessmentResponse(await fetch(listUrl(source), { headers: { "X-Personal-Viewer": actor }, cache: "no-store" }), actor, source);
}
// Uses the existing field queue, pending-work tracking and working-view epoch.
// Callers retain the exact command across retries. Context Cards allow a future
// fork modal to participate in Update locks for both viewer and original source.
export function persistAssessment(command: AssessmentCommand, contextCardIds: readonly string[] = []): Promise<AssessmentMutationResult> {
  assertAssessmentCommand(command);
  command = structuredClone(command); // Queue/retry intent must survive caller edits.
  const actor = command.viewerUserId, source = command.source;
  const key = source.kind === "card" ? `card:${source.cardTemplateId}:tests` : "item-tests";
  const cardIds = [...new Set([...contextCardIds, ...(source.kind === "card" ? [source.cardTemplateId] : [])])];
  let uncertain = false;
  const accept = (result: AssessmentMutationResult) => { workingCardStore.invalidate(actor); return result; };
  const reconcile = async () => {
    const list = await readPersonalAssessments(actor, source);
    const outcome = reconcileAssessment(command, list);
    if (outcome) return accept({ ...list, outcome });
    if (list.revision !== command.expectedRevision) throw new AssessmentConflict(list);
    return null; // A confirmed unchanged revision permits the original operation.
  };
  const operation = () => enqueuePersonalMutation(JSON.stringify([actor, key]), async () => {
    if (uncertain) { const result = await reconcile(); if (result) return result; }
    uncertain = true;
    try {
      const url = command.action === "add" ? listUrl(source) : `${listUrl(source)}/${encodeURIComponent(command.id)}`;
      const response = await fetch(url, { method: command.action === "add" ? "POST" : command.action === "update" ? "PATCH" : "DELETE",
        headers: { "Content-Type": "application/json", "X-Personal-Viewer": actor }, body: JSON.stringify(command) });
      const result = await assessmentResponse(response, actor, source) as AssessmentMutationResult;
      uncertain = false; return accept(result);
    } catch (error) {
      if (error instanceof AssessmentConflict || error instanceof AssessmentHttpError && error.status < 500) { uncertain = false; throw error; }
      // Network/5xx outcomes may have committed. Read before replay; if unchanged,
      // leave the operation pending for an explicit existing PersonalWork retry.
      const result = await reconcile();
      if (result) { uncertain = false; return result; }
      throw error;
    }
  });
  return personalWork.run({ userId: actor, cardIds }, key, operation);
}

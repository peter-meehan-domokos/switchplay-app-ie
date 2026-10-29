import { assertAssessmentSource, sameAssessmentSource, type AssessmentSource } from "./contracts";
import { requireCondition } from "../cards/domain";
import type { AssessmentHistory } from "./history";

export type AssessmentHistoryResponse = { viewerUserId: string; cardTemplateId?: string; itemId?: string; configured?: boolean; history: AssessmentHistory };
export async function readAssessmentHistory(actor: string, source: AssessmentSource, signal?: AbortSignal): Promise<AssessmentHistoryResponse> {
  assertAssessmentSource(source);
  const url = source.kind === "card" ? `/api/cards-data/${encodeURIComponent(source.cardTemplateId)}/assessment-history`
    : `/api/items-data/${encodeURIComponent(source.itemId)}/history`;
  const response = await fetch(url, { headers: { "X-Personal-Viewer": actor }, cache: "no-store", signal });
  requireCondition(response.headers.get("X-Personal-Viewer") === actor, "ASSESSMENT_SESSION_CONFLICT");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Unable to load assessment history.");
  requireCondition(data.viewerUserId === actor && (source.kind === "card" ? data.cardTemplateId === source.cardTemplateId : data.itemId === source.itemId), "ASSESSMENT_SESSION_CONFLICT");
  const history = data.history;
  requireCondition(history && ["complete", "empty", "incomplete"].includes(history.state) && Array.isArray(history.results)
    && Array.isArray(history.latestThree) && history.latestThree.length <= 3 && Array.isArray(history.sources) && Array.isArray(history.issues), "INVALID_ASSESSMENT_RESPONSE");
  for (const row of history.results) assertAssessmentSource(row.source);
  for (const row of history.latestThree) requireCondition(history.results.some((result: { id: string; source: AssessmentSource }) => result.id === row.id && sameAssessmentSource(result.source, row.source)), "INVALID_ASSESSMENT_RESPONSE");
  requireCondition(history.state !== "incomplete" || !history.latestThree.length, "INVALID_ASSESSMENT_RESPONSE");
  return data;
}

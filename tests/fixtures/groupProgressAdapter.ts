import type { GroupProgressPreview } from "./groupProgress";
import type { AssessmentContext } from "../../src/components/assessments/useAssessmentHistory";
import type { AssessmentHistoryResponse } from "../../src/lib/assessments/historyClient";

declare global { interface Window { groupProgressPreview: GroupProgressPreview } }
// Bundler-only dependency substitution. There is no application flag, API or
// personal store entry for these Group results. Values are passed directly in.
export async function readProgressMetadata() { return window.groupProgressPreview.metadata; }
export async function readProgressSummary(actor: string, frameworkId: string) {
  const fixture = window.groupProgressPreview;
  if (actor !== fixture.actor || frameworkId !== fixture.summary.id) throw Error("Unknown fixture scope");
  return fixture.summary;
}
export function useAssessmentHistory(context: AssessmentContext) {
  const fixture = window.groupProgressPreview;
  if (context.viewerUserId !== fixture.actor || context.source.kind !== "item" || !fixture.histories[context.source.itemId])
    throw Error("Unknown fixture assessment source");
  const data: AssessmentHistoryResponse = { viewerUserId: fixture.actor, itemId: context.source.itemId,
    configured: true, history: fixture.histories[context.source.itemId] };
  // Reuse the existing read-only states of the real modal, not a new editor.
  // No Add/Edit/Delete is possible and no personal assessment API is invoked.
  return { data, loading: false, error: undefined, refresh() {} };
}

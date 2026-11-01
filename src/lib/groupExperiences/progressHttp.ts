import { assertAssessmentId } from "../assessments/contracts";
import { groupRequest, query } from "./http";
import { readGroupProgressSummary, readScopedAssessmentHistory } from "./progressReads";
import type { ProgressPerspective } from "./progressContext";

export async function groupProgressRequest(request: Request, experienceId: string, frameworkId: string,
  target?: { frameworkItemId: string } | { cardTemplateId: string }) {
  return groupRequest(request, async (repo, actor) => {
    const params = query(request, ["subjectUserId"]), subject = params.get("subjectUserId");
    if (subject !== null) assertAssessmentId(subject);
    if (target) assertAssessmentId("cardTemplateId" in target ? target.cardTemplateId : target.frameworkItemId);
    const perspective: ProgressPerspective = subject === null ? { kind: "group" } : { kind: "player", userId: subject };
    return target ? readScopedAssessmentHistory(repo, actor, experienceId, frameworkId, perspective, target)
      : readGroupProgressSummary(repo, actor, experienceId, frameworkId, perspective);
  });
}

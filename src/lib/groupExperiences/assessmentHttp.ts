import { requireCondition } from "../cards/domain";
import { assertAssessmentId, sameAssessmentSource, type AssessmentSource } from "../assessments/contracts";
import { groupRequest, query } from "./http";
import { mutateGroupAssessment, readGroupAssessmentHistory, readGroupAssessments } from "./assessments";
import { assertGroupAssessmentCommand, groupAssessmentSource } from "./assessmentContracts";

export async function groupAssessmentRequest(request: Request, experienceId: string, source: AssessmentSource,
  action?: "add" | "update" | "delete" | "history", id?: string) {
  return groupRequest(request, async (repo, actor) => {
    query(request, []);
    if (action === "history") return readGroupAssessmentHistory(repo, actor, experienceId, source);
    if (!action) return readGroupAssessments(repo, actor, experienceId, source);
    const command: unknown = await request.json(); assertGroupAssessmentCommand(command);
    requireCondition(command.action === action && sameAssessmentSource(groupAssessmentSource(command.target), source), "ASSESSMENT_SOURCE_CONFLICT");
    if (id !== undefined) { assertAssessmentId(id); requireCondition(command.id === id, "ASSESSMENT_ID_CONFLICT"); }
    return mutateGroupAssessment(repo, actor, experienceId, source, command);
  });
}

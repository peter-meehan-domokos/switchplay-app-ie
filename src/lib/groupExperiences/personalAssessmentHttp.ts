import { requireCondition } from "../cards/domain";
import { assertAssessmentCommand, assertAssessmentId, sameAssessmentSource, type AssessmentSource } from "../assessments/contracts";
import { groupRequest, query } from "./http";
import { personalGroupAssessments } from "./personalAssessments";
import { getFrameworks } from "../frameworks/configuration";

export async function personalGroupAssessmentRequest(request: Request, experienceId: string, source: AssessmentSource,
  action?: "add" | "update" | "delete", id?: string, frameworkId?: string) {
  let viewer: string | undefined;
  const response = await groupRequest(request, async (repo, actor) => {
    viewer = actor; query(request, []);
    const expected = request.headers.get("X-Personal-Viewer");
    requireCondition(expected === null || expected === actor, "ASSESSMENT_SESSION_CONFLICT");
    if (!action) return personalGroupAssessments(repo, actor, experienceId, source, undefined, getFrameworks(), frameworkId);
    const command: unknown = await request.json(); assertAssessmentCommand(command);
    requireCondition(command.action === action && sameAssessmentSource(command.source, source), "ASSESSMENT_SOURCE_CONFLICT");
    if (id !== undefined) { assertAssessmentId(id); requireCondition(command.id === id, "ASSESSMENT_ID_CONFLICT"); }
    return personalGroupAssessments(repo, actor, experienceId, source, command, getFrameworks(), frameworkId);
  });
  // These endpoints still operate on the authenticated personal owner. Preserve
  // both Group authority and the existing personal assessment transport checks.
  if (viewer) response.headers.set("X-Personal-Viewer", viewer);
  return response;
}

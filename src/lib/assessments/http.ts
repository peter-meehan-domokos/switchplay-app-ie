import { personalUpdateRequest } from "../cards/http";
import { requireCondition } from "../cards/domain";
import { assertAssessmentCommand, assertAssessmentId, sameAssessmentSource, type AssessmentSource } from "./contracts";
import { mutateAssessment, readAssessmentList } from "./repository";

// Routes pin the actual storage source and immutable result ID. Unknown fields
// (including caller-supplied creation timestamps) are rejected by the contract.
export async function assessmentRequest(request: Request, source: AssessmentSource, action?: "add" | "update" | "delete", id?: string) {
  return personalUpdateRequest(request, async (repo, actor) => {
    if (!action) return readAssessmentList(repo, actor, source);
    const command: unknown = await request.json();
    assertAssessmentCommand(command);
    requireCondition(command.action === action && sameAssessmentSource(command.source, source), "ASSESSMENT_SOURCE_CONFLICT");
    if (id !== undefined) { assertAssessmentId(id); requireCondition(id === command.id, "ASSESSMENT_ID_CONFLICT"); }
    return mutateAssessment(repo, actor, command);
  });
}

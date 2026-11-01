import { groupAssessmentRequest } from "@/lib/groupExperiences/assessmentHttp";
type Context = { params: Promise<{ experienceId: string; frameworkItemId: string; testId: string }> };
export async function PATCH(request: Request, context: Context) {
  const { experienceId, frameworkItemId, testId } = await context.params;
  return groupAssessmentRequest(request, experienceId, { kind: "item", itemId: frameworkItemId }, "update", testId);
}
export async function DELETE(request: Request, context: Context) {
  const { experienceId, frameworkItemId, testId } = await context.params;
  return groupAssessmentRequest(request, experienceId, { kind: "item", itemId: frameworkItemId }, "delete", testId);
}

import { personalGroupAssessmentRequest } from "@/lib/groupExperiences/personalAssessmentHttp";
type Context = { params: Promise<{ experienceId: string; frameworkId: string; frameworkItemId: string; testId: string }> };
export async function PATCH(request: Request, context: Context) {
  const { experienceId, frameworkId, frameworkItemId, testId } = await context.params;
  return personalGroupAssessmentRequest(request, experienceId, { kind: "item", itemId: frameworkItemId }, "update", testId, frameworkId);
}
export async function DELETE(request: Request, context: Context) {
  const { experienceId, frameworkId, frameworkItemId, testId } = await context.params;
  return personalGroupAssessmentRequest(request, experienceId, { kind: "item", itemId: frameworkItemId }, "delete", testId, frameworkId);
}

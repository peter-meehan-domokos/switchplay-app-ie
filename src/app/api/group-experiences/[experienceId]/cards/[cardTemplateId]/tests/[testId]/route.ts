import { groupAssessmentRequest } from "@/lib/groupExperiences/assessmentHttp";
type Context = { params: Promise<{ experienceId: string; cardTemplateId: string; testId: string }> };
export async function PATCH(request: Request, context: Context) {
  const { experienceId, cardTemplateId, testId } = await context.params;
  return groupAssessmentRequest(request, experienceId, { kind: "card", cardTemplateId }, "update", testId);
}
export async function DELETE(request: Request, context: Context) {
  const { experienceId, cardTemplateId, testId } = await context.params;
  return groupAssessmentRequest(request, experienceId, { kind: "card", cardTemplateId }, "delete", testId);
}

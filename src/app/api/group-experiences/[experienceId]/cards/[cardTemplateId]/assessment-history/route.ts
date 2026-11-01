import { groupAssessmentRequest } from "@/lib/groupExperiences/assessmentHttp";
export async function GET(request: Request, context: { params: Promise<{ experienceId: string; cardTemplateId: string }> }) {
  const { experienceId, cardTemplateId } = await context.params;
  return groupAssessmentRequest(request, experienceId, { kind: "card", cardTemplateId }, "history");
}

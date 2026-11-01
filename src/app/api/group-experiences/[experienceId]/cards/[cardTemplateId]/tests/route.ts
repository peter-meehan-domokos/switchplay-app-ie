import { groupAssessmentRequest } from "@/lib/groupExperiences/assessmentHttp";
type Context = { params: Promise<{ experienceId: string; cardTemplateId: string }> };
export async function GET(request: Request, context: Context) {
  const { experienceId, cardTemplateId } = await context.params;
  return groupAssessmentRequest(request, experienceId, { kind: "card", cardTemplateId });
}
export async function POST(request: Request, context: Context) {
  const { experienceId, cardTemplateId } = await context.params;
  return groupAssessmentRequest(request, experienceId, { kind: "card", cardTemplateId }, "add");
}

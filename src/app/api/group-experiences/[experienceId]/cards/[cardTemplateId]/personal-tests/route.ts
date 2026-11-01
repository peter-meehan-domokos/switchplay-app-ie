import { personalGroupAssessmentRequest } from "@/lib/groupExperiences/personalAssessmentHttp";
type Context = { params: Promise<{ experienceId: string; cardTemplateId: string }> };
export async function GET(request: Request, context: Context) {
  const { experienceId, cardTemplateId } = await context.params;
  return personalGroupAssessmentRequest(request, experienceId, { kind: "card", cardTemplateId });
}
export async function POST(request: Request, context: Context) {
  const { experienceId, cardTemplateId } = await context.params;
  return personalGroupAssessmentRequest(request, experienceId, { kind: "card", cardTemplateId }, "add");
}

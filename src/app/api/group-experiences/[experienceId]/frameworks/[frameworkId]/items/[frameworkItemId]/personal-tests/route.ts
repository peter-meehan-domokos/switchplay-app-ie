import { personalGroupAssessmentRequest } from "@/lib/groupExperiences/personalAssessmentHttp";
type Context = { params: Promise<{ experienceId: string; frameworkId: string; frameworkItemId: string }> };
export async function GET(request: Request, context: Context) {
  const { experienceId, frameworkId, frameworkItemId } = await context.params;
  return personalGroupAssessmentRequest(request, experienceId, { kind: "item", itemId: frameworkItemId }, undefined, undefined, frameworkId);
}
export async function POST(request: Request, context: Context) {
  const { experienceId, frameworkId, frameworkItemId } = await context.params;
  return personalGroupAssessmentRequest(request, experienceId, { kind: "item", itemId: frameworkItemId }, "add", undefined, frameworkId);
}

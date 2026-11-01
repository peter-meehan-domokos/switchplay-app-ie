import { groupAssessmentRequest } from "@/lib/groupExperiences/assessmentHttp";
type Context = { params: Promise<{ experienceId: string; frameworkItemId: string }> };
export async function GET(request: Request, context: Context) {
  const { experienceId, frameworkItemId } = await context.params;
  return groupAssessmentRequest(request, experienceId, { kind: "item", itemId: frameworkItemId });
}
export async function POST(request: Request, context: Context) {
  const { experienceId, frameworkItemId } = await context.params;
  return groupAssessmentRequest(request, experienceId, { kind: "item", itemId: frameworkItemId }, "add");
}

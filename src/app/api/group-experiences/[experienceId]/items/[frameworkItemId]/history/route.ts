import { groupAssessmentRequest } from "@/lib/groupExperiences/assessmentHttp";
export async function GET(request: Request, context: { params: Promise<{ experienceId: string; frameworkItemId: string }> }) {
  const { experienceId, frameworkItemId } = await context.params;
  return groupAssessmentRequest(request, experienceId, { kind: "item", itemId: frameworkItemId }, "history");
}

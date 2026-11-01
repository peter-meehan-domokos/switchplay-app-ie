import { groupProgressRequest } from "@/lib/groupExperiences/progressHttp";
export async function GET(request: Request, context: { params: Promise<{ experienceId: string; frameworkId: string; frameworkItemId: string }> }) {
  const { experienceId, frameworkId, frameworkItemId } = await context.params;
  return groupProgressRequest(request, experienceId, frameworkId, { frameworkItemId });
}

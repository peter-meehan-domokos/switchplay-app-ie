import { groupProgressRequest } from "@/lib/groupExperiences/progressHttp";
export async function GET(request: Request, context: { params: Promise<{ experienceId: string; frameworkId: string }> }) {
  const { experienceId, frameworkId } = await context.params;
  return groupProgressRequest(request, experienceId, frameworkId);
}

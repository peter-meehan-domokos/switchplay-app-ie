import { visualApi } from "@/lib/visualLearningRecords/server";
export const runtime = "nodejs";
export async function POST(request: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  return visualApi().batch(request, (await params).attemptId);
}

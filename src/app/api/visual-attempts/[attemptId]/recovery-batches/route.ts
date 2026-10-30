import { visualApi } from "@/lib/visualLearningRecords/server";
export const runtime = "nodejs";
export async function POST(request: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  return visualApi(request).recovery(request, (await params).attemptId);
}

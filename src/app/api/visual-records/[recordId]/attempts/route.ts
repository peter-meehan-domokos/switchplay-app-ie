import { visualApi } from "@/lib/visualLearningRecords/server";
export const runtime = "nodejs";
export async function POST(request: Request, { params }: { params: Promise<{ recordId: string }> }) {
  return visualApi().newAttempt(request, (await params).recordId);
}

import { visualApi } from "@/lib/visualLearningRecords/server";
export const runtime = "nodejs";
export async function GET(request: Request, { params }: { params: Promise<{ recordId: string }> }) {
  return visualApi(request).current(request, (await params).recordId);
}

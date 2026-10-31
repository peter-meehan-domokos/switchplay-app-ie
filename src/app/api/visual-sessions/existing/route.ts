import { visualApi } from "@/lib/visualLearningRecords/server";
export const runtime = "nodejs";
export async function GET(request: Request) { return visualApi(request).existing(request); }

import { visualApi } from "@/lib/visualLearningRecords/server";
export const runtime = "nodejs";
export async function POST(request: Request) { return visualApi(request).open(request); }

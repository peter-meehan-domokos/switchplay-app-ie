import { visualClaimApi } from "@/lib/visualLearningRecords/claimServer";
export const runtime = "nodejs";
export async function POST(request: Request) { return visualClaimApi()(request); }

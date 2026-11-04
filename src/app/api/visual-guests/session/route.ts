import { visualGuestApi } from "@/lib/visualLearningRecords/guestServer";
export const runtime = "nodejs";
export async function POST(request: Request) { return visualGuestApi()(request); }

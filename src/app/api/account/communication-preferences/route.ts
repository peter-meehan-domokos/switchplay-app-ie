import { memberPreferencesResponse } from "@/lib/puckleCommunicationPreferences";

export async function POST(request: Request) { return memberPreferencesResponse(request); }

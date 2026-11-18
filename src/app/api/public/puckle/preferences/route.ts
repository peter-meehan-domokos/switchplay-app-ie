import { managePreferencesResponse } from "@/lib/puckleCommunicationPreferences";

export async function POST(request: Request) { return managePreferencesResponse(request); }

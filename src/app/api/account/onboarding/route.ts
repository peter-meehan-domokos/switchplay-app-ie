import { onboardingAcknowledgeResponse, onboardingStatusResponse } from "@/lib/onboarding";

export async function GET() { return onboardingStatusResponse(); }
export async function POST(request: Request) { return onboardingAcknowledgeResponse(request); }

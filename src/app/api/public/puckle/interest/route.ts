import { handleInterestContact, respondAndNotify } from "@/lib/puckleRegistration";

export async function POST(request: Request) {
  return respondAndNotify(await handleInterestContact(request));
}

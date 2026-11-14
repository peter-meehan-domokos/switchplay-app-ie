import { handleNoEmailContact, respondAndNotify } from "@/lib/puckleRegistration";

export async function POST(request: Request) {
  return respondAndNotify(await handleNoEmailContact(request));
}

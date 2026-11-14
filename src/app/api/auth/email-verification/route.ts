import { getDatabase } from "@/lib/mongodb";
import { requestEmailChallenge, verifyEmailChallenge } from "@/lib/accountEmailChallenges";
import { securityRequest, securityJson, securityError } from "@/lib/accountSecurityHttp";
export async function POST(request: Request) {
  try {
    const { body, requester, mail } = await securityRequest(request), db = await getDatabase();
    if (body.action === "verify") return securityJson(await verifyEmailChallenge(db, body));
    if (body.action !== "request") return securityJson({ error: "Invalid request." }, 400);
    const binding = await requestEmailChallenge(db, { email: body.email, binding: body.binding, requester }, mail);
    return securityJson({ ...binding, message: "Check your email for the next step." });
  } catch (error) { return securityError(error); }
}

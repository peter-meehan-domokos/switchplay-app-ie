import { ObjectId } from "mongodb";
import { getCurrentUser } from "@/lib/auth";
import { securityJson, securityRequest } from "@/lib/accountSecurityHttp";
import { getDatabase } from "@/lib/mongodb";
import { approvalSummary, requestParentalApproval } from "@/lib/parentalApproval";
import { parentalApprovalError } from "@/lib/parentalApprovalHttp";
import { getCurrentSite } from "@/lib/sites/getCurrentSite";

// The signed-in student's own shared approval: identical on every site. No arbitrary-user lookup.
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return securityJson({ error: "Please sign in." }, 401);
    return securityJson(await approvalSummary(await getDatabase(), new ObjectId(user.id)));
  } catch (error) { return parentalApprovalError(error); }
}

export async function POST(request: Request) {
  try {
    const { body, requester, mail } = await securityRequest(request);
    const user = await getCurrentUser();
    if (!user) return securityJson({ error: "Please sign in." }, 401);
    if (body.action !== "request") return securityJson({ error: "Invalid request." }, 400);
    if (body.expectedUserId !== undefined && body.expectedUserId !== user.id) throw new Error("ACTOR_MISMATCH");
    const result = await requestParentalApproval(await getDatabase(), { userId: new ObjectId(user.id), guardianEmail: body.guardianEmail, sourceSite: await getCurrentSite(), requester }, mail);
    const message = result.delivery === "sent"
      ? "We've emailed your parent or guardian. You can keep learning while you wait."
      : "Your request is saved, but we couldn't confirm the email was sent. You can try sending it again in a minute.";
    return securityJson({ ...result, message });
  } catch (error) { return parentalApprovalError(error); }
}

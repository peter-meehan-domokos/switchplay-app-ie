import { ObjectId } from "mongodb";
import { after } from "next/server";
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
    const result = await requestParentalApproval(await getDatabase(), { userId: new ObjectId(user.id), guardianEmail: body.guardianEmail, guardianPhone: body.guardianPhone, phoneCountryCode: body.phoneCountryCode, sourceSite: await getCurrentSite(), requester }, mail);
    const { notify, ...visible } = result;
    if (notify) { try { after(notify); } catch { void notify(); } } // founder alert after the response, never awaited
    const message = visible.status === "contact-requested"
      ? "Thanks. We've passed your parent or guardian's number to Puckle and we'll contact them. Approval isn't recorded until that's done. You can keep learning privately meanwhile."
      : visible.delivery === "sent"
        ? "We've emailed your parent or guardian. You can keep learning while you wait."
        : "Your request is saved, but we couldn't confirm the email was sent. You can try sending it again in a minute.";
    return securityJson({ ...visible, message });
  } catch (error) { return parentalApprovalError(error); }
}

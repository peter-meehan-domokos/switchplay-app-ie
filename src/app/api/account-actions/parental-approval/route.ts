import { securityJson, securityRequest } from "@/lib/accountSecurityHttp";
import { getDatabase, getMongoClient } from "@/lib/mongodb";
import { decideParentalApproval, withdrawParentalApproval } from "@/lib/parentalApproval";
import { parentalApprovalError } from "@/lib/parentalApprovalHttp";

// Token-bound guardian decisions. The target is derived from the capability only; cookies are ignored.
export async function POST(request: Request) {
  try {
    const { body, mail } = await securityRequest(request);
    const db = await getDatabase(), client = await getMongoClient();
    if (body.decision === "withdraw") {
      await withdrawParentalApproval(db, client, { token: body.token, confirm: body.declaration });
      return securityJson({ status: "withdrawn", message: "Your approval has been withdrawn. Thank you for letting us know." });
    }
    const result = await decideParentalApproval(db, client, { token: body.token, decision: body.decision, declaration: body.declaration }, mail);
    const message = result.status === "approved"
      ? result.managementEmail === "sent"
        ? "Thank you. Your approval has been recorded. We've emailed you a link you can use to withdraw it at any time."
        // The approval is saved either way; only the follow-up email is uncertain, so say exactly that.
        : "Thank you. Your approval has been recorded. We tried to email you a link for withdrawing it later, but can't be sure it was sent. If it hasn't arrived in a few minutes, please contact us and we'll help."
      : "Thank you. Your decision to decline has been recorded.";
    return securityJson({ status: result.status, message });
  } catch (error) { return parentalApprovalError(error); }
}

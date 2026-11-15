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
      ? `Thank you. Your approval is recorded.${result.managementEmail === "sent" ? " We've emailed you a link you can use to withdraw it at any time." : " We couldn't confirm the email with your withdrawal link was sent; contact us if you need it."}`
      : "Thank you. You declined, and your choice is recorded.";
    return securityJson({ status: result.status, message });
  } catch (error) { return parentalApprovalError(error); }
}

import { securityJson, securityRequest } from "@/lib/accountSecurityHttp";
import { getDatabase, getMongoClient } from "@/lib/mongodb";
import { after } from "next/server";
import { decideParentalApproval } from "@/lib/parentalApproval";
import { parentalApprovalError } from "@/lib/parentalApprovalHttp";

// Token-bound guardian decisions. The target is derived from the capability only; cookies are ignored.
export async function POST(request: Request) {
  try {
    const { body, mail } = await securityRequest(request);
    const db = await getDatabase(), client = await getMongoClient();
    const result = await decideParentalApproval(db, client, { token: body.token, decision: body.decision, declaration: body.declaration }, mail);
    const { notify, status } = result;
    try { after(notify); } catch { void notify(); } // founder alert after the response, never awaited
    const message = status === "approved"
      ? "Thank you. Your approval has been recorded. You do not need to do anything else."
      : "Thank you. Your decision to decline has been recorded. You do not need to do anything else.";
    return securityJson({ status, message });
  } catch (error) { return parentalApprovalError(error); }
}

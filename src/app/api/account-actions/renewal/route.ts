import { securityJson, securityRequest } from "@/lib/accountSecurityHttp";
import { getDatabase } from "@/lib/mongodb";
import { renewParentLink } from "@/lib/parentalApproval";
import { parentalApprovalError } from "@/lib/parentalApprovalHttp";

// Neutral by design: never reveals whether a link was renewable or who the guardian is.
export async function POST(request: Request) {
  try {
    const { body, requester, mail } = await securityRequest(request);
    await renewParentLink(await getDatabase(), { token: body.token, requester }, mail);
    return securityJson({ message: "If this link can be renewed, we've sent a new one to the parent or guardian email on record." });
  } catch (error) { return parentalApprovalError(error); }
}

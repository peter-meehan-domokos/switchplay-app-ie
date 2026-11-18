import { getDatabase } from "@/lib/mongodb";
import { passwordResetDetails } from "@/lib/passwordRecovery";
import { parentLinkDetails } from "@/lib/parentalApproval";
import { securityRequest, securityJson, securityError } from "@/lib/accountSecurityHttp";
// Read-only: returns display context for the purpose bound to the token. Never decides or consumes anything.
export async function POST(request: Request) {
  try {
    const { body } = await securityRequest(request);
    const db = await getDatabase();
    try { return securityJson(await passwordResetDetails(db, body.token)); }
    catch (error) { if (!(error instanceof Error) || error.message !== "INVALID_EMAIL_PROOF") throw error; }
    return securityJson(await parentLinkDetails(db, body.token));
  } catch (error) { return securityError(error); }
}

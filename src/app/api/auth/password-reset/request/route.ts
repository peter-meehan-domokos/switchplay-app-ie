import { getDatabase } from "@/lib/mongodb";
import { requestPasswordReset } from "@/lib/passwordRecovery";
import { securityRequest, securityJson, securityError } from "@/lib/accountSecurityHttp";
export async function POST(request: Request) {
  try {
    const { body, requester, mail } = await securityRequest(request);
    await requestPasswordReset(await getDatabase(), body.email, requester, mail);
    return securityJson({ message: "If an account uses that email, a reset link will be sent. Check your inbox, or try again later if it does not arrive." });
  } catch (error) { return securityError(error); }
}

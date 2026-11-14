import { getDatabase } from "@/lib/mongodb";
import { passwordResetDetails } from "@/lib/passwordRecovery";
import { securityRequest, securityJson, securityError } from "@/lib/accountSecurityHttp";
export async function POST(request: Request) {
  try { const { body } = await securityRequest(request); return securityJson(await passwordResetDetails(await getDatabase(), body.token)); }
  catch (error) { return securityError(error); }
}

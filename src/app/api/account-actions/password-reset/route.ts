import { getDatabase, getMongoClient } from "@/lib/mongodb";
import { completePasswordReset } from "@/lib/passwordRecovery";
import { securityRequest, securityJson, securityError } from "@/lib/accountSecurityHttp";
export async function POST(request: Request) {
  try {
    const { body } = await securityRequest(request);
    await completePasswordReset(await getDatabase(), await getMongoClient(), body.token, body.password);
    return securityJson({ message: "Password changed. You can now sign in." });
  } catch (error) { return securityError(error); }
}

import { getCurrentSite } from "./sites/getCurrentSite";
import { siteEmailConfig, siteEmailSender } from "./siteEmail";
export const SECURITY_HEADERS = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" };
export async function securityRequest(request: Request) {
  const site = await getCurrentSite(), config = siteEmailConfig(site);
  if (!config.allowedOrigins.includes(request.headers.get("origin") ?? "") || request.headers.get("content-type")?.split(";")[0] !== "application/json") throw new Error("INVALID_SECURITY_REQUEST");
  const text = await request.text();
  if (Buffer.byteLength(text) > 8192) throw new Error("INVALID_SECURITY_REQUEST");
  const body = JSON.parse(text);
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("INVALID_SECURITY_REQUEST");
  // Enable only behind a proxy that overwrites this header; otherwise share a conservative bucket.
  const requester = process.env.ACCOUNT_TRUST_PROXY_IP === "1" ? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown" : "unknown";
  return { body, requester, mail: { ...config, send: siteEmailSender(site) } };
}
export function securityJson(body: unknown, status = 200) { return Response.json(body, { status, headers: SECURITY_HEADERS }); }
export function securityError(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  if (code === "EMAIL_RATE_LIMITED") return securityJson({ error: "Please wait before trying again." }, 429);
  if (code === "INVALID_NEW_PASSWORD") return securityJson({ error: "Use at least 12 characters and at most 72 UTF-8 bytes." }, 400);
  if (["INVALID_EMAIL_PROOF", "INVALID_EMAIL", "INVALID_SECURITY_REQUEST"].includes(code) || error instanceof SyntaxError) return securityJson({ error: "Unable to use these details. Check them or request a new email." }, 400);
  // Never stringify or log provider errors, token payloads or passwords.
  return securityJson({ error: "Unable to complete this request. Please try again later." }, 503);
}

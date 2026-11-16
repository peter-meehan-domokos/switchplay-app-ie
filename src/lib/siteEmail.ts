import type { SiteId } from "./sites/siteResolver";
import { assertDisposableDatabase } from "./cards/localDatabase";
export type EmailMessage = { to: string; subject: string; text: string };
export type Delivery = { status: "sent" | "failed" | "unknown"; attemptedAt: Date; reference: string };
export type EmailSender = (message: EmailMessage) => Promise<Delivery>;
/** Manual phone review on a private network only. Requires the runner's disposable-database guard; never set in deployment. */
type Env = Record<string, string | undefined>;
function reviewLanOrigin(url: URL, env: Env) {
  if (env.ACCOUNT_EMAIL_LAN_REVIEW !== "1" || !/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url.hostname)) return false;
  try { assertDisposableDatabase(env.MONGODB_URI, env.MONGODB_DB); return true; } catch { return false; }
}
/** "Name <address@domain>" or a bare address. Resend rejects anything else, so refuse it before sending. */
export function isValidSender(from: string) {
  if (/[\r\n]/.test(from)) return false;
  return /^[^<>]{1,100}<[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+>$/.test(from.trim()) || /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(from.trim());
}
export function siteEmailConfig(site: SiteId, env: Env = process.env) {
  const prefix = `ACCOUNT_EMAIL_${site.toUpperCase()}`;
  const origin = env[`${prefix}_ORIGIN`], from = env[`${prefix}_FROM`];
  if (!origin || !from) throw new Error("EMAIL_CONFIGURATION_REQUIRED");
  if (!isValidSender(from)) throw new Error("EMAIL_CONFIGURATION_INVALID");
  const allowedOrigins = [origin, ...(env[`${prefix}_ALLOWED_ORIGINS`]?.split(",").map(value => value.trim()).filter(Boolean) ?? [])];
  for (const candidate of allowedOrigins) {
  let url: URL;
  try { url = new URL(candidate); } catch { throw new Error("EMAIL_CONFIGURATION_INVALID"); }
  const local = ["localhost", "127.0.0.1"].includes(url.hostname) || url.hostname.endsWith(".localhost") || reviewLanOrigin(url, env);
  if ((url.protocol !== "https:" && !(local && url.protocol === "http:")) || url.username || url.password || url.origin !== candidate) throw new Error("EMAIL_CONFIGURATION_INVALID");
  }
  return { origin, allowedOrigins, from, name: { puckle: "Puckle", switchplay: "Switchplay", strat17: "Strat17" }[site] };
}
/**
 * TESTING ONLY. When ACCOUNT_EMAIL_REDIRECT_TO is a single valid address, every message is delivered to that
 * inbox instead of its real recipient, clearly labelled with who it was meant for, so real delivery can be
 * exercised end to end without emailing anyone else. Unset in production.
 */
export function redirectedMessage(message: EmailMessage, redirectTo: string | undefined): EmailMessage {
  const target = redirectTo?.trim();
  if (!target) return message;
  if (!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(target)) throw new Error("EMAIL_CONFIGURATION_INVALID");
  return { to: target, subject: `[TEST for ${message.to}] ${message.subject}`, text: `TEST REDIRECT: this email was intended for ${message.to}.\n\n${message.text}` };
}
/** No request-host links or fallback sender. Provider acceptance is not inbox delivery. */
export function siteEmailSender(site: SiteId, env: Env = process.env): EmailSender {
  const config = siteEmailConfig(site, env);
  return async (original) => {
    const attemptedAt = new Date();
    try {
      const message = redirectedMessage(original, env.ACCOUNT_EMAIL_REDIRECT_TO);
      let endpoint = "https://api.resend.com/emails";
      const fixture = env.ACCOUNT_EMAIL_TEST_ENDPOINT;
      if (fixture) {
        assertDisposableDatabase(env.MONGODB_URI, env.MONGODB_DB);
        const url = new URL(fixture);
        if (url.protocol !== "http:" || url.hostname !== "127.0.0.1") throw new Error("INVALID_TEST_TRANSPORT");
        endpoint = fixture;
      } else if (!env.RESEND_API_KEY || env.ACCOUNT_EMAIL_TRACKING_DISABLED !== "1") {
        return { status: "failed", attemptedAt, reference: "configuration-required" };
      }
      const response = await fetch(endpoint, { method: "POST", signal: AbortSignal.timeout(8000),
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${fixture ? "local-fixture" : env.RESEND_API_KEY}` },
        body: JSON.stringify({ from: config.from, to: [message.to], subject: message.subject, text: message.text,
          ...(original.to !== message.to ? { headers: { "X-Intended-Recipient": original.to } } : {}) }),
      });
      if (response.status === 429) return { status: "failed", attemptedAt, reference: "provider-rate-limited" };
      if (!response.ok) return { status: "failed", attemptedAt, reference: `provider-http-${response.status}` };
      if (fixture) return { status: "sent", attemptedAt, reference: "fixture-accepted" };
      // Keep only Resend's message id (for looking the email up in the Resend dashboard); never the rest of the body.
      const body = await response.json().catch(() => null) as { id?: unknown } | null;
      const id = typeof body?.id === "string" && /^[A-Za-z0-9-]{8,64}$/.test(body.id) ? body.id : null;
      return { status: "sent", attemptedAt, reference: id ? `resend:${id}` : "provider-accepted" };
    } catch {
      return { status: "unknown", attemptedAt, reference: "transport-interrupted" };
    }
  };
}

/** Even an injected provider failure cannot leave an outcome falsely marked sent. */
export async function deliverEmail(send: EmailSender, message: EmailMessage): Promise<Delivery> {
  try { return await send(message); }
  catch { return { status: "unknown", attemptedAt: new Date(), reference: "transport-interrupted" }; }
}

/**
 * Names-only readiness report for real delivery (no values are ever returned). Used by the operator
 * command `scripts/email-delivery.ts --check` before enabling or testing production email.
 */
export function emailConfigurationReport(env: Env = process.env, only?: SiteId) {
  const problems: string[] = [];
  if (!env.RESEND_API_KEY) problems.push("RESEND_API_KEY is not set");
  else if (!/^re_[A-Za-z0-9_]{8,}$/.test(env.RESEND_API_KEY)) problems.push("RESEND_API_KEY does not look like a Resend API key (re_...)");
  if (env.ACCOUNT_EMAIL_TRACKING_DISABLED !== "1") problems.push("ACCOUNT_EMAIL_TRACKING_DISABLED must be 1 once open/click tracking is turned off for the sending domain in Resend");
  if (!env.ACCOUNT_EMAIL_SECRET || Buffer.byteLength(env.ACCOUNT_EMAIL_SECRET) < 32) problems.push("ACCOUNT_EMAIL_SECRET must be a random secret of at least 32 bytes");
  if (env.ACCOUNT_EMAIL_TEST_ENDPOINT) problems.push("ACCOUNT_EMAIL_TEST_ENDPOINT is a test-only setting and must not be set where real email is sent");
  const founder = env.PUCKLE_FOUNDER_EMAIL?.trim();
  if (!founder || !/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(founder)) problems.push("PUCKLE_FOUNDER_EMAIL is not a single valid address (founder alerts would be recorded as failed)");
  const sites = (["puckle", "switchplay", "strat17"] as const).filter(site => !only || site === only).map(site => {
    try {
      const config = siteEmailConfig(site, env);
      if (!config.origin.startsWith("https://")) problems.push(`ACCOUNT_EMAIL_${site.toUpperCase()}_ORIGIN is not https (only acceptable for local testing)`);
      return { site, ready: true };
    } catch (error) {
      problems.push(`ACCOUNT_EMAIL_${site.toUpperCase()}_ORIGIN/_FROM ${error instanceof Error && error.message === "EMAIL_CONFIGURATION_INVALID" ? "invalid" : "missing"}`);
      return { site, ready: false };
    }
  });
  const redirect = env.ACCOUNT_EMAIL_REDIRECT_TO?.trim() || null;
  if (redirect && !/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(redirect)) problems.push("ACCOUNT_EMAIL_REDIRECT_TO is not a single valid address");
  return { ready: problems.length === 0, sites, problems, redirect };
}

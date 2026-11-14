import type { SiteId } from "./sites/siteResolver";
import { assertDisposableDatabase } from "./cards/localDatabase";
export type EmailMessage = { to: string; subject: string; text: string };
export type Delivery = { status: "sent" | "failed" | "unknown"; attemptedAt: Date; reference: string };
export type EmailSender = (message: EmailMessage) => Promise<Delivery>;
/** Manual phone review on a private network only. Requires the runner's disposable-database guard; never set in deployment. */
function reviewLanOrigin(url: URL) {
  if (process.env.ACCOUNT_EMAIL_LAN_REVIEW !== "1" || !/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url.hostname)) return false;
  try { assertDisposableDatabase(process.env.MONGODB_URI, process.env.MONGODB_DB); return true; } catch { return false; }
}
export function siteEmailConfig(site: SiteId) {
  const prefix = `ACCOUNT_EMAIL_${site.toUpperCase()}`;
  const origin = process.env[`${prefix}_ORIGIN`], from = process.env[`${prefix}_FROM`];
  if (!origin || !from || /[\r\n]/.test(from)) throw new Error("EMAIL_CONFIGURATION_REQUIRED");
  const allowedOrigins = [origin, ...(process.env[`${prefix}_ALLOWED_ORIGINS`]?.split(",").map(value => value.trim()).filter(Boolean) ?? [])];
  for (const candidate of allowedOrigins) {
  const url = new URL(candidate);
  const local = ["localhost", "127.0.0.1"].includes(url.hostname) || url.hostname.endsWith(".localhost") || reviewLanOrigin(url);
  if ((url.protocol !== "https:" && !(local && url.protocol === "http:")) || url.username || url.password || url.origin !== candidate) throw new Error("EMAIL_CONFIGURATION_INVALID");
  }
  return { origin, allowedOrigins, from, name: { puckle: "Puckle", switchplay: "Switchplay", strat17: "Strat17" }[site] };
}
/** No request-host links or fallback sender. Provider acceptance is not inbox delivery. */
export function siteEmailSender(site: SiteId): EmailSender {
  const config = siteEmailConfig(site);
  return async (message) => {
    const attemptedAt = new Date();
    try {
      let endpoint = "https://api.resend.com/emails";
      const fixture = process.env.ACCOUNT_EMAIL_TEST_ENDPOINT;
      if (fixture) {
        assertDisposableDatabase(process.env.MONGODB_URI, process.env.MONGODB_DB);
        const url = new URL(fixture);
        if (url.protocol !== "http:" || url.hostname !== "127.0.0.1") throw new Error("INVALID_TEST_TRANSPORT");
        endpoint = fixture;
      } else if (!process.env.RESEND_API_KEY || process.env.ACCOUNT_EMAIL_TRACKING_DISABLED !== "1") {
        return { status: "failed", attemptedAt, reference: "configuration-required" };
      }
      const response = await fetch(endpoint, { method: "POST", signal: AbortSignal.timeout(8000),
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${fixture ? "local-fixture" : process.env.RESEND_API_KEY}` },
        body: JSON.stringify({ from: config.from, to: [message.to], subject: message.subject, text: message.text }),
      });
      if (!response.ok) return { status: "failed", attemptedAt, reference: `provider-http-${response.status}` };
      // Do not persist or log provider response bodies (which can echo input).
      return { status: "sent", attemptedAt, reference: fixture ? "fixture-accepted" : "provider-accepted" };
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

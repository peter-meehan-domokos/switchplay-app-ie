import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { deliverEmail, emailConfigurationReport, siteEmailSender } from "../src/lib/siteEmail";
import { isSiteId } from "../src/lib/sites/siteResolver";

/**
 * Operator command for real email delivery through Resend. Never prints a secret or an email body.
 *   --check [--site <site>]                              readiness report (variable names only), optionally for one site
 *   --send-test --site <puckle|switchplay|strat17> --to <address> --confirm-send
 *                                                        sends ONE plain test message through the real sender
 * It does not connect to any database.
 */
const USAGE = "usage: email-delivery --check [--site <site>] | --send-test --site <puckle|switchplay|strat17> --to <address> --confirm-send";
export async function main(args = process.argv.slice(2), env: Record<string, string | undefined> = process.env) {
  const value = (name: string) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
  const only = value("--site"), scope = isSiteId(only) ? only : undefined;
  const report = emailConfigurationReport(env, scope);
  if (args.includes("--check")) {
    console.log(report.ready ? "Email delivery is configured." : `Email delivery is NOT ready:\n  ${report.problems.join("\n  ")}`);
    if (report.redirect) console.log(`TEST REDIRECT ACTIVE: every email is delivered to ${report.redirect}, labelled "[TEST for <intended address>]". Not for production.`);
    console.log(report.sites.map(row => `${row.site}: ${row.ready ? "sender and origin configured" : "not configured"}`).join("\n"));
    return report.ready ? 0 : 2;
  }
  if (!args.includes("--send-test")) { console.log(USAGE); return 1; }
  const site = value("--site"), to = value("--to")?.trim();
  if (!isSiteId(site) || !to || !/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(to)) { console.error(USAGE); return 1; }
  if (!args.includes("--confirm-send")) { console.error("Refusing to send without --confirm-send."); return 1; }
  if (!report.ready) { console.error(`Email delivery is NOT ready:\n  ${report.problems.join("\n  ")}`); return 2; }
  const delivery = await deliverEmail(siteEmailSender(site, env), { to, subject: `${site} email delivery test`, text: "This is a delivery test from the website's account email system. No action is needed." });
  // Status and the provider reference only; acceptance by Resend is not proof of inbox delivery.
  console.log(`Delivery ${delivery.status} (${delivery.reference}). Check the inbox (and spam) for "${site} email delivery test".`);
  return delivery.status === "sent" ? 0 : 3;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) void main().then(code => { process.exitCode = code; });

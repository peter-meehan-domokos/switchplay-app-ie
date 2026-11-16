import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { deliverEmail, emailConfigurationReport, isValidSender, redirectedMessage, siteEmailConfig, siteEmailSender } from "../src/lib/siteEmail";
import { main } from "../scripts/email-delivery";

// The real Resend adapter, exercised against a stubbed fetch: no network, no real email.
const KEY = "re_TestOnlyKey_1234567890";
const READY: Record<string, string> = {
  RESEND_API_KEY: KEY, ACCOUNT_EMAIL_TRACKING_DISABLED: "1", ACCOUNT_EMAIL_SECRET: "x".repeat(40), PUCKLE_FOUNDER_EMAIL: "founder@puckleup.com",
  ACCOUNT_EMAIL_PUCKLE_ORIGIN: "https://puckleup.com", ACCOUNT_EMAIL_PUCKLE_FROM: "Puckle <hello@puckleup.com>",
  ACCOUNT_EMAIL_SWITCHPLAY_ORIGIN: "https://switchplay.ie", ACCOUNT_EMAIL_SWITCHPLAY_FROM: "Switchplay <hello@switchplay.ie>",
  ACCOUNT_EMAIL_STRAT17_ORIGIN: "https://strat17.com", ACCOUNT_EMAIL_STRAT17_FROM: "hello@strat17.com",
};
const saved = { ...process.env }, realFetch = globalThis.fetch;
type Call = { url: string; init: RequestInit };
let calls: Call[] = [], reply: () => Promise<Response> = async () => Response.json({ id: "4ef9a417-02e9-4d39-ad75-9611e0fcc33c" });
beforeEach(() => {
  calls = []; reply = async () => Response.json({ id: "4ef9a417-02e9-4d39-ad75-9611e0fcc33c" });
  for (const key of Object.keys(process.env)) if (key.startsWith("ACCOUNT_EMAIL_") || key === "RESEND_API_KEY" || key === "PUCKLE_FOUNDER_EMAIL") delete process.env[key];
  Object.assign(process.env, READY);
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => { calls.push({ url: String(url), init: init ?? {} }); return reply(); }) as typeof fetch;
});
afterEach(() => { globalThis.fetch = realFetch; for (const key of Object.keys(process.env)) delete process.env[key]; Object.assign(process.env, saved); });
const message = { to: "parent@example.com", subject: "Puckle: approval needed for Niamh", text: "Open https://puckleup.com/api/account-actions/open#secret" };

test("sends one Resend API request with the trusted sender, bearer key, JSON body and a timeout", async () => {
  const delivery = await siteEmailSender("puckle")(message);
  assert.equal(calls.length, 1); const [{ url, init }] = calls;
  assert.equal(url, "https://api.resend.com/emails"); assert.equal(init.method, "POST"); assert.ok(init.signal, "bounded by a timeout");
  const headers = init.headers as Record<string, string>;
  assert.equal(headers.Authorization, `Bearer ${KEY}`); assert.equal(headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(String(init.body)), { from: "Puckle <hello@puckleup.com>", to: ["parent@example.com"], subject: message.subject, text: message.text, reply_to: "support@puckleup.com" });
  assert.deepEqual([delivery.status, delivery.reference], ["sent", "resend:4ef9a417-02e9-4d39-ad75-9611e0fcc33c"]);
});
test("each site sends from its own configured identity", async () => {
  await siteEmailSender("switchplay")(message); await siteEmailSender("strat17")(message);
  assert.deepEqual(calls.map(call => JSON.parse(String(call.init.body)).from), ["Switchplay <hello@switchplay.ie>", "hello@strat17.com"]);
});
test("provider outcomes are recorded truthfully and never echo the response body or the key", async () => {
  const cases: [() => Promise<Response>, string, string][] = [
    [async () => new Response("{\"message\":\"parent@example.com is invalid\"}", { status: 422 }), "failed", "provider-http-422"],
    [async () => new Response("{}", { status: 401 }), "failed", "provider-http-401"],
    [async () => new Response("{}", { status: 429 }), "failed", "provider-rate-limited"],
    [async () => new Response("{}", { status: 503 }), "failed", "provider-http-503"],
    [async () => new Response("not json", { status: 200 }), "sent", "provider-accepted"],
    [async () => Response.json({ id: "<script>" }), "sent", "provider-accepted"],
    [async () => { throw new DOMException("timed out", "TimeoutError"); }, "unknown", "transport-interrupted"],
    [async () => { throw new TypeError("network down"); }, "unknown", "transport-interrupted"],
  ];
  for (const [respond, status, reference] of cases) {
    reply = respond; const delivery = await siteEmailSender("puckle")(message);
    assert.deepEqual([delivery.status, delivery.reference], [status, reference], reference);
    assert.ok(!JSON.stringify(delivery).includes(KEY) && !JSON.stringify(delivery).includes("parent@example.com"));
  }
});
test("without a key, or before tracking is confirmed off, nothing is sent and the outcome says why", async () => {
  for (const missing of ["RESEND_API_KEY", "ACCOUNT_EMAIL_TRACKING_DISABLED"]) {
    delete process.env[missing]; calls = [];
    assert.deepEqual((await siteEmailSender("puckle")(message)).reference, "configuration-required"); assert.equal(calls.length, 0, missing);
    Object.assign(process.env, READY);
  }
  assert.equal((await deliverEmail(async () => { throw new Error("boom"); }, message)).status, "unknown");
});
test("sender identities must be a real address, optionally with a display name; no header injection", () => {
  for (const ok of ["Puckle <hello@puckleup.com>", "hello@puckleup.com", "Puckle Team <no-reply@mail.puckleup.com>"]) assert.equal(isValidSender(ok), true, ok);
  for (const bad of ["Puckle", "Puckle <hello>", "hello@puckleup.com\nBcc: x@y.z", "<hello@puckleup.com", "a b@puckleup.com"]) assert.equal(isValidSender(bad), false, bad);
  assert.throws(() => siteEmailConfig("puckle", { ...READY, ACCOUNT_EMAIL_PUCKLE_FROM: "Puckle" }), /INVALID/);
  assert.throws(() => siteEmailConfig("puckle", { ...READY, ACCOUNT_EMAIL_PUCKLE_ORIGIN: "not a url" }), /INVALID/);
  assert.throws(() => siteEmailConfig("puckle", { ...READY, ACCOUNT_EMAIL_PUCKLE_ORIGIN: "http://puckleup.com" }), /INVALID/, "https only outside local testing");
});
test("replies to Puckle email go to support@puckleup.com; other sites only if configured; never an invalid address", async () => {
  await siteEmailSender("puckle")(message); await siteEmailSender("switchplay")(message);
  assert.equal(JSON.parse(String(calls[0].init.body)).reply_to, "support@puckleup.com"); assert.equal("reply_to" in JSON.parse(String(calls[1].init.body)), false);
  process.env.ACCOUNT_EMAIL_PUCKLE_REPLY_TO = "Puckle Help <help@puckleup.com>"; await siteEmailSender("puckle")(message);
  assert.equal(JSON.parse(String(calls[2].init.body)).reply_to, "Puckle Help <help@puckleup.com>");
  assert.equal(JSON.parse(String(calls[2].init.body)).from, "Puckle <hello@puckleup.com>", "sender is unchanged");
  assert.throws(() => siteEmailConfig("puckle", { ...READY, ACCOUNT_EMAIL_PUCKLE_REPLY_TO: "not an address" }), /INVALID/);
});
test("the readiness report can be limited to one site", () => {
  const partial = { ...READY, ACCOUNT_EMAIL_SWITCHPLAY_FROM: undefined, ACCOUNT_EMAIL_STRAT17_ORIGIN: undefined };
  assert.equal(emailConfigurationReport(partial).ready, false);
  assert.deepEqual(emailConfigurationReport(partial, "puckle"), { ready: true, redirect: null, sites: [{ site: "puckle", ready: true }], problems: [] });
});
test("test redirect: every message goes to one inbox, labelled with its intended recipient; off by default", async () => {
  assert.deepEqual(redirectedMessage(message, undefined), message); assert.deepEqual(redirectedMessage(message, "  "), message);
  const redirected = redirectedMessage(message, "peter@example.org");
  assert.deepEqual([redirected.to, redirected.subject], ["peter@example.org", "[TEST for parent@example.com] Puckle: approval needed for Niamh"]);
  assert.match(redirected.text, /^TEST REDIRECT: this email was intended for parent@example\.com\.\n\n/); assert.ok(redirected.text.endsWith(message.text));
  assert.throws(() => redirectedMessage(message, "a@b.com, c@d.com"), /INVALID/);
  process.env.ACCOUNT_EMAIL_REDIRECT_TO = "peter@example.org";
  await siteEmailSender("puckle")(message);
  const sent = JSON.parse(String(calls[0].init.body)); assert.deepEqual(sent.to, ["peter@example.org"]); assert.match(sent.subject, /^\[TEST for parent@example\.com\]/);
  assert.equal(sent.headers["X-Intended-Recipient"], "parent@example.com"); assert.ok(!JSON.stringify(sent).includes('"to":["parent@example.com"]'));
  assert.equal(emailConfigurationReport({ ...READY, ACCOUNT_EMAIL_REDIRECT_TO: "peter@example.org" }).redirect, "peter@example.org");
  assert.match(emailConfigurationReport({ ...READY, ACCOUNT_EMAIL_REDIRECT_TO: "nope" }).problems.join(), /REDIRECT_TO/);
});
test("the readiness report names what is missing without revealing any value", () => {
  assert.deepEqual(emailConfigurationReport(READY), { ready: true, redirect: null, sites: [{ site: "puckle", ready: true }, { site: "switchplay", ready: true }, { site: "strat17", ready: true }], problems: [] });
  const report = emailConfigurationReport({ ...READY, RESEND_API_KEY: "sk_live_wrong", ACCOUNT_EMAIL_TRACKING_DISABLED: "0", PUCKLE_FOUNDER_EMAIL: "", ACCOUNT_EMAIL_TEST_ENDPOINT: "http://127.0.0.1:1/email", ACCOUNT_EMAIL_STRAT17_FROM: undefined });
  assert.equal(report.ready, false);
  for (const name of ["RESEND_API_KEY", "ACCOUNT_EMAIL_TRACKING_DISABLED", "PUCKLE_FOUNDER_EMAIL", "ACCOUNT_EMAIL_TEST_ENDPOINT", "ACCOUNT_EMAIL_STRAT17"]) assert.ok(report.problems.some(problem => problem.includes(name)), name);
  assert.ok(!JSON.stringify(report).includes("sk_live_wrong"));
  assert.match(emailConfigurationReport({ ...READY, ACCOUNT_EMAIL_SECRET: "short" }).problems.join(), /ACCOUNT_EMAIL_SECRET/);
});
async function capture(run: () => Promise<number>) {
  const lines: string[] = [], log = console.log, error = console.error;
  console.log = (...parts) => void lines.push(parts.join(" ")); console.error = (...parts) => void lines.push(parts.join(" "));
  try { return { code: await run(), output: lines.join("\n") }; } finally { console.log = log; console.error = error; }
}
test("operator command: --check reports readiness; --send-test needs explicit confirmation and sends exactly one message", async () => {
  const check = await capture(() => main(["--check"], READY)); assert.equal(check.code, 0); assert.match(check.output, /configured/); assert.ok(!check.output.includes(KEY));
  const notReady = await capture(() => main(["--check"], { ...READY, RESEND_API_KEY: undefined })); assert.equal(notReady.code, 2); assert.match(notReady.output, /RESEND_API_KEY is not set/);
  calls = [];
  assert.equal((await capture(() => main(["--send-test", "--site", "puckle", "--to", "me@example.com"], READY))).code, 1); assert.equal(calls.length, 0, "no send without --confirm-send");
  assert.equal((await capture(() => main(["--send-test", "--site", "nowhere", "--to", "me@example.com", "--confirm-send"], READY))).code, 1);
  const sent = await capture(() => main(["--send-test", "--site", "puckle", "--to", "me@example.com", "--confirm-send"], READY));
  assert.equal(sent.code, 0); assert.equal(calls.length, 1); assert.match(sent.output, /Delivery sent \(resend:/); assert.ok(!sent.output.includes(KEY));
  assert.deepEqual(JSON.parse(String(calls[0].init.body)).to, ["me@example.com"]);
});

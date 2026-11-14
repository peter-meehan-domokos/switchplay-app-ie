import assert from "node:assert/strict";
import { test } from "node:test";
import { normaliseAccountEmail, validateCoreCredentials, validateNewPassword } from "../src/lib/accountCredentials";
import { emailActionDocument } from "../src/lib/emailActionDocument";
import { siteEmailConfig, siteEmailSender } from "../src/lib/siteEmail";
import { protectedDigest } from "../src/lib/emailActionTokens";
test("new credential rules preserve exact username case, normalise email and never trim passwords", () => {
  assert.deepEqual(validateCoreCredentials({ username: " Exact-Case_1 ", email: " X@EXAMPLE.COM ", password: " twelve chars " }), { username: "Exact-Case_1", email: "x@example.com", password: " twelve chars " });
  for (const username of ["ab", "a".repeat(31), "name@site", "na mé"]) assert.throws(() => validateCoreCredentials({ username, email: "a@b.com", password: "long-password" }), /USERNAME/);
  for (const email of [null, "a@b", "a @b.com"]) assert.throws(() => normaliseAccountEmail(email), /EMAIL/);
});
test("password length is Unicode characters and bcrypt bytes, without composition rules", () => {
  assert.equal(validateNewPassword("a".repeat(72)).length, 72);
  assert.equal(validateNewPassword("😀".repeat(18)), "😀".repeat(18));
  for (const password of ["short", "😀".repeat(11), "😀".repeat(19), "a".repeat(73), null]) assert.throws(() => validateNewPassword(password), /PASSWORD/);
});
test("action document has nonce CSP, no external resources, no cookies or automatic mutation", async () => {
  const response = emailActionDocument(), text = await response.text();
  assert.equal(response.headers.get("cache-control"), "no-store"); assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.match(response.headers.get("content-security-policy")!, /frame-ancestors 'none'/);
  assert.match(text, /history.replaceState/); assert.match(text, /credentials:'omit'/);
  assert.doesNotMatch(text, /<script[^>]+src=|<link|analytics|document.cookie|localStorage|sessionStorage/);
  assert.ok(text.indexOf("form.addEventListener('submit'") < text.indexOf("post('/api/account-actions/password-reset'"));
});
test("email configuration requires explicit trusted origin and sender for every site", () => {
  for (const site of ["puckle", "switchplay", "strat17"] as const) {
    process.env[`ACCOUNT_EMAIL_${site.toUpperCase()}_ORIGIN`] = `https://${site}.example`;
    process.env[`ACCOUNT_EMAIL_${site.toUpperCase()}_FROM`] = `${site} <security@example.invalid>`;
    assert.equal(siteEmailConfig(site).origin, `https://${site}.example`);
  }
  process.env.ACCOUNT_EMAIL_PUCKLE_ORIGIN = "https://example.invalid/path";
  assert.throws(() => siteEmailConfig("puckle"), /CONFIGURATION/);
});
test("protected code digests require a distinct configured key and bind all context", () => {
  process.env.ACCOUNT_EMAIL_SECRET = "test-only-key-with-at-least-32-bytes";
  assert.notEqual(protectedDigest("code", "a", "1", "123456"), protectedDigest("code", "b", "1", "123456"));
});
test("email provider errors expose no response payload or secrets", async () => {
  process.env.ACCOUNT_EMAIL_PUCKLE_ORIGIN = "https://puckle.example";
  delete process.env.ACCOUNT_EMAIL_TEST_ENDPOINT; delete process.env.RESEND_API_KEY;
  const result = await siteEmailSender("puckle")({ to: "fixture@example.invalid", subject: "fixture", text: "secret" });
  assert.equal(result.status, "failed"); assert.equal(result.reference, "configuration-required");
});

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createServer, type Server } from "node:http";
import { once } from "node:events";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { MongoClient, ObjectId, type Db } from "mongodb";
import { preparePuckleMembership } from "../scripts/prepare-puckle-membership";
import {
  approvalSummary, decideParentalApproval, parentLinkDetails, renewParentLink, requestParentalApproval, revokeParentalApprovalAsOperator,
} from "../src/lib/parentalApproval";
import { completePasswordReset, requestPasswordReset } from "../src/lib/passwordRecovery";
import { getSafeguardingFacts } from "../src/lib/userSafeguarding";
import { GROUP_EXPERIENCE_EXPLANATION } from "../src/lib/parentalApprovalScope";
import type { EmailMessage, Delivery } from "../src/lib/siteEmail";

let server: MongoMemoryReplSet, client: MongoClient, db: Db, fixture: Server;
const founderMail: { to: string[]; subject: string; text: string }[] = [];
const messages: EmailMessage[] = [];
let deliver: () => Delivery["status"] = () => "sent";
const mail = { name: "Puckle", origin: "https://puckle.invalid", send: async (message: EmailMessage) => { messages.push(message); return { status: deliver(), attemptedAt: new Date(), reference: "fixture" } as Delivery; } };
const T0 = new Date("2026-11-14T10:00:00Z"), at = (ms: number) => new Date(T0.getTime() + ms), MIN = 61_000, DAY = 86_400_000;
let n = 0;
before(async () => {
  server = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  Object.assign(process.env, { MONGODB_URI: server.getUri(), MONGODB_DB: "switchplay_test_parental_approval", SWITCHPLAY_DATABASE_MODE: "disposable",
    SESSION_SECRET: "test-session-secret", ACCOUNT_EMAIL_SECRET: "test-email-key-with-at-least-32-bytes" });
  // Founder alerts use the real sender, pointed at a local fixture endpoint (disposable database only).
  Object.assign(process.env, { PUCKLE_FOUNDER_EMAIL: "founder@example.invalid", ACCOUNT_EMAIL_PUCKLE_ORIGIN: "http://127.0.0.1:3999", ACCOUNT_EMAIL_PUCKLE_FROM: "Puckle fixture <x@example.invalid>" });
  fixture = createServer((req, res) => { let body = ""; req.on("data", c => { body += c; }); req.on("end", () => { founderMail.push(JSON.parse(body)); res.end("{}"); }); });
  fixture.listen(0, "127.0.0.1"); await once(fixture, "listening"); process.env.ACCOUNT_EMAIL_TEST_ENDPOINT = `http://127.0.0.1:${(fixture.address() as { port: number }).port}`;
  client = await new MongoClient(server.getUri()).connect(); db = client.db(process.env.MONGODB_DB); await preparePuckleMembership(db);
});
after(async () => { await client?.close(); await server?.stop(); fixture?.close(); });

async function child(dateOfBirth: string | null = "2012-05-01", profile = true) {
  const _id = new ObjectId(), seq = ++n;
  const doc = { _id, email: `child-${seq}@example.invalid`, username: `Child${seq}`, passwordHash: "$2a$04$unchanged", sessionVersion: 0,
    cardsData: [{ cardTemplateId: "c", progress: [1, 2] }], decksData: [{ deckTemplateId: "d" }], sharedDeckData: [], permissions: { publicPublishing: false },
    ...(dateOfBirth ? { safeguarding: { dateOfBirth, dobSource: "self-declared", dobRecordedAt: T0, ageAssurance: { verification: "none" } } } : {}), createdAt: T0, updatedAt: T0 };
  await db.collection("users").insertOne(doc);
  if (profile) await db.collection("puckleMemberships").insertOne({ userId: _id, name: `Kid${seq}`, registrationCategory: "student", mobile: null, initialRegistrationSource: "join", welcome: { eligible: true }, createdAt: T0, updatedAt: T0 });
  return doc;
}
const guardian = () => `guardian-${++n}@example.invalid`;
const request = (userId: ObjectId, guardianEmail: string, now = T0, sourceSite: "puckle" | "switchplay" | "strat17" = "puckle") =>
  requestParentalApproval(db, { userId, guardianEmail, sourceSite, requester: `req-${userId}` }, mail, now);
const lastToken = (to: string) => messages.filter(m => m.to === to).at(-1)!.text.match(/#([\w-]{43})/)![1];
const approval = async (userId: ObjectId) => (await db.collection("users").findOne({ _id: userId }))!.safeguarding.groupExperienceApproval;
/** Everything except the approval subtree must be exactly as before. */
const untouched = async (before: { _id: ObjectId } & Record<string, unknown>) => {
  const after = (await db.collection("users").findOne({ _id: before._id }))!;
  const strip = (doc: Record<string, unknown>) => { const copy = structuredClone(doc) as { safeguarding?: Record<string, unknown> }; if (copy.safeguarding) delete copy.safeguarding.groupExperienceApproval; return copy; };
  assert.deepEqual(strip(after), strip(before));
};
const decide = (token: string, decision: string, declaration: unknown = true, now = at(DAY)) => decideParentalApproval(db, client, { token, decision, declaration }, mail, () => now);

test("eligibility: unknown DOB and 16+ cannot request; under-16 can; requesting never creates a parent account", async () => {
  const usersBefore = await db.collection("users").countDocuments();
  await assert.rejects(request((await child(null))._id, guardian()), /APPROVAL_AGE_UNKNOWN/);
  await assert.rejects(request((await child("2010-11-14"))._id, guardian()), /APPROVAL_NOT_REQUIRED/, "16th birthday today");
  const young = await child("2010-11-15"), email = guardian();
  assert.equal((await request(young._id, email)).status, "pending", "the day before 16");
  assert.equal(await db.collection("users").countDocuments({ email }), 0); assert.equal(await db.collection("users").countDocuments(), usersBefore + 3);
});
test("a request records the common scope, draft explanation, provenance and history; sends a 7-day link; changes nothing else", async () => {
  const kid = await child(), email = guardian(), result = await request(kid._id, email, T0, "switchplay");
  const { notify, ...visibleResult } = result as typeof result & { notify?: unknown }; assert.equal(typeof notify, "function");
  assert.deepEqual(visibleResult, { status: "pending", resent: false, delivery: "sent" });
  const record = await approval(kid._id);
  assert.deepEqual([record.scopeId, record.status, record.generation, record.sourceSite, record.guardianEmail, record.explanation.version, record.delivery.status],
    ["shared-group-experiences", "pending", 1, "switchplay", email, GROUP_EXPERIENCE_EXPLANATION.version, "sent"]);
  assert.deepEqual(record.history.map((e: { kind: string; actor: { kind: string } }) => [e.kind, e.actor.kind]), [["requested", "student"]]);
  const token = lastToken(email), link = (await db.collection("accountEmailActions").findOne({ userId: kid._id, purpose: "parent-request" }))!;
  assert.equal(link.expiresAt.getTime() - T0.getTime(), 7 * DAY); assert.ok(!JSON.stringify(link).includes(token), "only a digest is stored");
  assert.match(messages.at(-1)!.text, /Group Experiences on Puckle\./); assert.doesNotMatch(messages.at(-1)!.text, /switchplay|strat17/i); assert.match(messages.at(-1)!.text, /Opening the link changes nothing/);
  await untouched(kid);
  const summary = await approvalSummary(db, kid._id, "2026-11-14");
  assert.deepEqual([summary.status, summary.eligibility, summary.canRequest, summary.delivery], ["pending", "eligible", true, "sent"]); assert.ok(!summary.guardianEmail!.includes(email.split("@")[0]));
});
test("own email, malformed email and rapid resends are refused; a later resend replaces the old link", async () => {
  const kid = await child(), email = guardian();
  await assert.rejects(request(kid._id, kid.email), /GUARDIAN_EMAIL_IS_ACCOUNT/); await assert.rejects(request(kid._id, "not-an-email"), /INVALID_EMAIL/);
  await request(kid._id, email); const first = lastToken(email);
  await assert.rejects(request(kid._id, email, at(5_000)), /RATE_LIMITED/, "about one-minute cooldown");
  const resent = await request(kid._id, email, at(MIN)); assert.equal(resent.status === "pending" && resent.resent, true);
  const second = lastToken(email); assert.notEqual(first, second); assert.equal((await approval(kid._id)).generation, 1, "a resend keeps the generation");
  assert.deepEqual(await parentLinkDetails(db, first, at(MIN + 1)), { purpose: "parent-request", state: "replaced", renewable: true });
  await assert.rejects(decide(first, "approve"), /LINK_NOT_USABLE/);
  assert.equal((await parentLinkDetails(db, second, at(MIN + 1))).state, "valid");
  await assert.rejects(request(kid._id, email, at(2 * MIN)), /RATE_LIMITED/); await assert.rejects(request(kid._id, email, at(3 * MIN)), /RATE_LIMITED/, "three per recipient per hour");
});
test("failed or uncertain delivery is reported truthfully and leaves a pending request that can be resent", async () => {
  const kid = await child(), email = guardian();
  deliver = () => "failed";
  try { assert.equal(((await request(kid._id, email)) as { delivery: string }).delivery, "failed"); } finally { deliver = () => "sent"; }
  assert.deepEqual([(await approval(kid._id)).status, (await approval(kid._id)).delivery.status], ["pending", "failed"]);
  assert.equal((await approvalSummary(db, kid._id)).delivery, "failed");
  assert.equal(((await request(kid._id, email, at(MIN))) as { delivery: string }).delivery, "sent"); assert.equal((await approval(kid._id)).delivery.status, "sent");
});
test("reading the link changes nothing; approval needs the declaration and records evidence without verifying age", async () => {
  const kid = await child(), email = guardian(); await request(kid._id, email); const token = lastToken(email);
  const before = await approval(kid._id), details = await parentLinkDetails(db, token, at(1000));
  assert.equal(details.state, "valid"); assert.equal((details as { child: string }).child, `Kid${n - 1}`);
  assert.ok(!("sites" in details), "no list of other sites is sent to the page"); assert.ok(!JSON.stringify(details).match(/2012|example\.invalid/), "no DOB or email in page context");
  assert.deepEqual(await approval(kid._id), before);
  await assert.rejects(decide(token, "approve", false), /DECLARATION_REQUIRED/); await assert.rejects(decide(token, "maybe"), /INVALID_DECISION/);
  assert.equal((await approval(kid._id)).status, "pending");
  const decision = await decide(token, "approve"); assert.equal(decision.status, "approved"); assert.equal(typeof decision.notify, "function");
  const record = await approval(kid._id);
  assert.deepEqual([record.status, record.guardianDeclaration.textVersion, record.decidedAt.toISOString()], ["approved", "guardian-declaration-v1", at(DAY).toISOString()]);
  assert.deepEqual(record.history.at(-1).actor.kind, "guardian"); assert.equal(record.history.at(-1).guardianEmail, email);
  const facts = await getSafeguardingFacts(db, kid._id);
  assert.deepEqual([facts.ageAssurance, facts.dateOfBirth, facts.approvalStatus], [{ verification: "none" }, "2012-05-01", "approved"]);
  await untouched(kid);
  await assert.rejects(decide(token, "decline"), /LINK_NOT_USABLE/, "replay cannot change the decision");
  assert.equal((await parentLinkDetails(db, token, at(DAY))).state, "decided");
  assert.equal((await approval(kid._id)).status, "approved");
});
test("concurrent decisions on one link: exactly one wins", async () => {
  const kid = await child(), email = guardian(); await request(kid._id, email); const token = lastToken(email);
  const results = await Promise.allSettled([decide(token, "approve"), decide(token, "decline"), decide(token, "approve")]);
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  const record = await approval(kid._id); assert.equal(record.history.filter((e: { kind: string }) => ["approved", "declined"].includes(e.kind)).length, 1);
});
test("two children's links in two tabs each act only on the child their token names", async () => {
  const a = await child(), b = await child(), email = guardian();
  await request(a._id, email); const tokenA = lastToken(email); await request(b._id, email, at(MIN)); const tokenB = lastToken(email);
  await decide(tokenB, "decline"); await decide(tokenA, "approve");
  assert.deepEqual([(await approval(a._id)).status, (await approval(b._id)).status], ["approved", "declined"]);
});
test("wrong-purpose and forged tokens cannot act", async () => {
  const kid = await child(), email = guardian(); await request(kid._id, email); const requestToken = lastToken(email);
  await requestPasswordReset(db, kid.email, "req-reset", mail, T0); const resetToken = lastToken(kid.email);
  await assert.rejects(decide(resetToken, "approve"), /INVALID_EMAIL_PROOF/);
  await assert.rejects(completePasswordReset(db, client, requestToken, "a brand new password", () => T0), /INVALID_EMAIL_PROOF/);
  for (const forged of ["x".repeat(43), "short", undefined, 42]) await assert.rejects(decide(forged as string, "approve"), /INVALID_EMAIL_PROOF/);
  const sentBefore = messages.length; await decide(requestToken, "approve");
  assert.equal(messages.length, sentBefore, "approving sends the parent no further email: there is no withdrawal link");
  assert.equal(await db.collection("accountEmailActions").countDocuments({ userId: kid._id, purpose: "parent-management" }), 0);
  assert.equal((await approval(kid._id)).status, "approved");
});
test("expired links cannot decide; they renew only to the recorded guardian, and only within the retention window", async () => {
  const kid = await child(), email = guardian(); await request(kid._id, email); const old = lastToken(email), sent = messages.length;
  const expired = at(7 * DAY + 1000);
  assert.deepEqual(await parentLinkDetails(db, old, expired), { purpose: "parent-request", state: "expired", renewable: true });
  await assert.rejects(decide(old, "approve", true, expired), /LINK_NOT_USABLE/);
  await renewParentLink(db, { token: old, requester: "attacker" }, mail, expired);
  assert.equal(messages.length, sent + 1); assert.equal(messages.at(-1)!.to, email, "never an arbitrary recipient");
  const fresh = lastToken(email); assert.equal((await parentLinkDetails(db, fresh, expired)).state, "valid");
  assert.equal((await approval(kid._id)).history.at(-1).kind, "resent");
  assert.equal((await parentLinkDetails(db, old, at(40 * DAY))).renewable, false, "after cleanup window");
  await renewParentLink(db, { token: "y".repeat(43), requester: "x" }, mail, expired); assert.equal(messages.length, sent + 1, "unknown tokens are silent");
});
test("replacing the guardian while pending invalidates the first guardian's link entirely", async () => {
  const kid = await child(), first = guardian(), second = guardian();
  await request(kid._id, first); const firstToken = lastToken(first); await request(kid._id, second, at(MIN)); const secondToken = lastToken(second);
  assert.equal((await approval(kid._id)).generation, 2);
  assert.deepEqual(await parentLinkDetails(db, firstToken, at(MIN)), { purpose: "parent-request", state: "decided", renewable: false });
  await renewParentLink(db, { token: firstToken, requester: "x" }, mail, at(2 * MIN)); assert.equal(messages.at(-1)!.to, second, "old guardian gets nothing new");
  await assert.rejects(decide(firstToken, "approve"), /LINK_NOT_USABLE/); await decide(secondToken, "approve");
  assert.equal((await approval(kid._id)).guardianEmail, second);
});
test("approved: no silent guardian change; an operator revocation keeps evidence and learning, and a re-request starts a new generation", async () => {
  const kid = await child(), email = guardian(); await request(kid._id, email); await decide(lastToken(email), "approve");
  await assert.rejects(request(kid._id, guardian(), at(2 * DAY)), /APPROVAL_ALREADY_GRANTED/);
  await assert.rejects(revokeParentalApprovalAsOperator(db, client, kid._id, { actor: "", reason: "x" }), /REVIEW_DETAILS_REQUIRED/);
  await revokeParentalApprovalAsOperator(db, client, kid._id, { actor: "founder", reason: "Reviewed: guardian details disputed" }, at(2 * DAY));
  const record = await approval(kid._id), last = record.history.at(-1);
  assert.deepEqual([record.status, record.withdrawnAt.toISOString(), last.kind, last.actor, last.reason], ["withdrawn", at(2 * DAY).toISOString(), "revoked", { kind: "operator", reference: "founder" }, "Reviewed: guardian details disputed"]);
  assert.deepEqual(record.history.map((e: { kind: string }) => e.kind), ["requested", "approved", "revoked"]);
  await untouched(kid);
  await request(kid._id, email, at(3 * DAY)); const again = await approval(kid._id);
  assert.deepEqual([again.status, again.generation, again.withdrawnAt, again.guardianDeclaration], ["pending", 2, undefined, undefined]);
  assert.equal(again.history.find((e: { kind: string }) => e.kind === "approved").declarationVersion, "guardian-declaration-v1", "past declaration kept in history");
});
test("decline allows an explicit re-request, and a decision link cannot be used again", async () => {
  const kid = await child(), email = guardian(); await request(kid._id, email); const declineToken = lastToken(email); await decide(declineToken, "decline");
  assert.equal((await approvalSummary(db, kid._id)).canRequest, true);
  await assert.rejects(decide(declineToken, "approve"), /LINK_NOT_USABLE/);
  await request(kid._id, email, at(2 * DAY)); await decide(lastToken(email), "approve", true, at(3 * DAY));
  assert.equal((await approval(kid._id)).status, "approved");
});
test("founder alerts for decisions: [FYI] approved / declined, after the response, with the parent's contact details and no link or date of birth", async () => {
  for (const [decision, subject, outcome] of [["approve", /^\[FYI\] ✅ PARENT APPROVED: Kid\d+$/, "approved"], ["decline", /^\[FYI\] ❌ PARENT DECLINED: Kid\d+$/, "declined"]] as const) {
    const kid = await child(), email = guardian();
    await requestParentalApproval(db, { userId: kid._id, guardianEmail: email, guardianPhone: "087 123 9999", sourceSite: "puckle", requester: `d-${kid._id}` }, mail, T0);
    const token = lastToken(email), sent = founderMail.length;
    const result = await decide(token, decision); assert.equal(result.status, outcome); assert.equal(founderMail.length, sent, "not sent during the decision");
    assert.deepEqual((await approval(kid._id)).decisionFounderNotification, undefined, "recorded only once sent");
    await result.notify(); const alert = founderMail.at(-1)!;
    assert.deepEqual(alert.to, ["founder@example.invalid"]); assert.match(alert.subject, subject);
    assert.ok(alert.text.includes(`Decided by (email): ${email}`)); assert.ok(alert.text.includes("+353871239999")); assert.ok(alert.text.includes(" UTC"));
    assert.ok(!alert.text.includes(token) && !/2012|date of birth|open#/i.test(alert.text), "no link, token or date of birth");
    assert.equal((await approval(kid._id)).decisionFounderNotification.status, "sent");
    assert.equal((await db.collection("users").findOne({ _id: kid._id }))!.decisionFounderNotification, undefined, "kept beside the approval record, not on the account");
  }
});
test("one approval is the same shared fact on every website; a different source site needs no second approval", async () => {
  const kid = await child(), email = guardian(); await request(kid._id, email, T0, "strat17"); await decide(lastToken(email), "approve");
  const facts = await getSafeguardingFacts(db, kid._id);
  assert.deepEqual([facts.approvalScopeId, facts.approvalStatus, facts.groupExperienceApproval!.sourceSite], ["shared-group-experiences", "approved", "strat17"]);
  for (const site of ["puckle", "switchplay"] as const) await assert.rejects(request(kid._id, email, at(2 * DAY), site), /APPROVAL_ALREADY_GRANTED/);
  const user = (await db.collection("users").findOne({ _id: kid._id }))!;
  assert.deepEqual(Object.keys(user.safeguarding).sort(), ["ageAssurance", "dateOfBirth", "dobRecordedAt", "dobSource", "groupExperienceApproval"], "no per-site approval keys");
  assert.equal(JSON.stringify(user).match(/puckleApproved|switchplayApproved|strat17Approved|parentApproved/), null);
});
test("shared facts need no Puckle profile; a child without one is addressed by username", async () => {
  const kid = await child("2012-01-01", false), email = guardian(); await request(kid._id, email);
  assert.equal((await parentLinkDetails(db, lastToken(email), at(1000)) as { child: string }).child, kid.username);
});

const asPending = <T extends { status: string }>(result: T) => { assert.equal(result.status, "pending"); return result as Extract<T, { status: "pending" }>; };
test("a new approval request alerts the founder (FYI) with the parent's email and optional mobile; resends do not", async () => {
  const kid = await child(), email = guardian();
  const first = asPending(await requestParentalApproval(db, { userId: kid._id, guardianEmail: email, guardianPhone: "087 123 4567", sourceSite: "puckle", requester: `r-${kid._id}` }, mail, T0));
  assert.equal(typeof first.notify, "function"); assert.equal(founderMail.some(m => m.text.includes(email)), false, "sent after the response, not during the request");
  const record = await approval(kid._id); assert.equal(record.guardianPhone, "+353871234567"); assert.deepEqual(record.founderNotification, { status: "pending" });
  await first.notify!();
  const alert = founderMail.at(-1)!; assert.deepEqual(alert.to, ["founder@example.invalid"]); assert.match(alert.subject, /^\[FYI\] 👪 PARENT APPROVAL SENT: Kid\d+$/);
  assert.ok(alert.text.includes(`Parent/guardian email: ${email}`)); assert.ok(alert.text.includes("+353871234567")); assert.match(alert.text, /Email delivery: sent/); assert.ok(!/2012|date of birth/i.test(alert.text));
  assert.equal((await approval(kid._id)).founderNotification.status, "sent");
  assert.equal((await db.collection("users").findOne({ _id: kid._id }))!.founderNotification, undefined, "outcome lives with the approval record, not at the top of the account");
  const resend = asPending(await requestParentalApproval(db, { userId: kid._id, guardianEmail: email, sourceSite: "puckle", requester: `r2-${kid._id}` }, mail, at(MIN)));
  assert.equal(resend.resent, true); assert.equal(resend.notify, undefined, "no alert for a resend"); assert.equal((await approval(kid._id)).guardianPhone, "+353871234567", "a resend keeps the stored mobile");
});
test("the parent mobile is optional with an email; it is validated, normalised and replaced or cleared on a new request", async () => {
  const kid = await child(), one = guardian(), two = guardian();
  await assert.rejects(requestParentalApproval(db, { userId: kid._id, guardianEmail: one, guardianPhone: "12", sourceSite: "puckle", requester: "x1" }, mail, T0), /INVALID_MOBILE/);
  assert.equal((await db.collection("users").findOne({ _id: kid._id }))!.safeguarding.groupExperienceApproval, undefined, "nothing saved on a bad number");
  await requestParentalApproval(db, { userId: kid._id, guardianEmail: one, guardianPhone: "+353 86 765 4321", sourceSite: "puckle", requester: "x2" }, mail, T0);
  assert.equal((await approval(kid._id)).guardianPhone, "+353867654321");
  await requestParentalApproval(db, { userId: kid._id, guardianEmail: two, sourceSite: "puckle", requester: "x3" }, mail, at(MIN));
  assert.equal((await approval(kid._id)).guardianPhone, undefined, "a different guardian starts clean");
});
test("a parent with no email: only a mobile saves a contact request and alerts the founder (ACTION); no approval is recorded and nothing is emailed to anyone", async () => {
  const kid = await child(), sent = messages.length, before = JSON.stringify((await db.collection("users").findOne({ _id: kid._id }))!.safeguarding);
  const result = await requestParentalApproval(db, { userId: kid._id, guardianPhone: "087 111 2222", sourceSite: "puckle", requester: "p1" }, mail, T0);
  assert.equal(result.status, "contact-requested"); assert.equal(messages.length, sent, "no approval email exists to send");
  assert.equal(JSON.stringify((await db.collection("users").findOne({ _id: kid._id }))!.safeguarding), before, "approval state untouched: not pending, not approved");
  assert.equal(await db.collection("accountEmailActions").countDocuments({ userId: kid._id, purpose: "parent-request" }), 0);
  const row = (await db.collection("puckleJoinContactRequests").findOne({ studentUserId: kid._id }))!;
  assert.deepEqual([row.kind, row.guardianMobile, row.founderNotification], ["guardian-approval-contact-request", "+353871112222", { status: "pending" }]);
  await result.notify(); const alert = founderMail.at(-1)!;
  assert.match(alert.subject, /^\[ACTION\] 📞 PARENT HAS NO EMAIL, PLEASE CALL: Kid\d+$/); assert.ok(alert.text.includes("+353871112222")); assert.match(alert.text, /NOT recorded/);
  assert.equal((await db.collection("puckleJoinContactRequests").findOne({ _id: row._id }))!.founderNotification.status, "sent");
});
test("a parent contact needs an email or a mobile, only under-16 students can ask, and phone-only is rate limited", async () => {
  const kid = await child();
  await assert.rejects(requestParentalApproval(db, { userId: kid._id, sourceSite: "puckle", requester: "n1" }, mail, T0), /GUARDIAN_CONTACT_REQUIRED/);
  await assert.rejects(requestParentalApproval(db, { userId: kid._id, guardianEmail: "  ", guardianPhone: "  ", sourceSite: "puckle", requester: "n1" }, mail, T0), /GUARDIAN_CONTACT_REQUIRED/);
  await assert.rejects(requestParentalApproval(db, { userId: kid._id, guardianPhone: "abc", sourceSite: "puckle", requester: "n2" }, mail, T0), /INVALID_MOBILE/);
  for (const dob of [null, "2010-11-14"]) await assert.rejects(requestParentalApproval(db, { userId: (await child(dob))._id, guardianPhone: "087 111 2222", sourceSite: "puckle", requester: "n3" }, mail, T0), /APPROVAL_(AGE_UNKNOWN|NOT_REQUIRED)/);
  const approved = await child(), email = guardian(); await request(approved._id, email); await decide(lastToken(email), "approve");
  await assert.rejects(requestParentalApproval(db, { userId: approved._id, guardianPhone: "087 111 2222", sourceSite: "puckle", requester: "n4" }, mail, at(2 * DAY)), /APPROVAL_ALREADY_GRANTED/);
  const results = await Promise.allSettled(Array.from({ length: 6 }, () => requestParentalApproval(db, { userId: kid._id, guardianPhone: "087 111 2222", sourceSite: "puckle", requester: "flood" }, mail, T0)));
  assert.equal(results.filter(r => r.status === "fulfilled").length, 5); assert.equal(results.filter(r => r.status === "rejected").length, 1, "the sixth in an hour is refused");
});

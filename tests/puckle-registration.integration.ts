import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { once } from "node:events";
import { after, before, test } from "node:test";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { MongoClient, ObjectId, type Db } from "mongodb";
import bcrypt from "bcryptjs";
import { preparePuckleMembership } from "../scripts/prepare-puckle-membership";
import { requestEmailChallenge, verifyEmailChallenge } from "../src/lib/accountEmailChallenges";
import { prepareAccountCredentials, readSessionToken } from "../src/lib/auth";
import { getMongoClient, withMongoTransaction } from "../src/lib/mongodb";
import { notifyFounder } from "../src/lib/founderNotifications";
import { saveInterestContact, saveNoEmailJoinContact } from "../src/lib/puckleJoinContacts";
import { registerPuckleMember, type RegistrationInput } from "../src/lib/puckleRegistration";
import { requirePublicPublishing } from "../src/lib/userPermissions";
import type { EmailMessage } from "../src/lib/siteEmail";

let server: MongoMemoryReplSet, client: MongoClient, db: Db, fixture: Server, fixtureOrigin = "", fixtureDelayMs = 0;
const captured: { to: string[]; subject: string; text: string }[] = [];
const mail = { name: "Fixture", origin: "https://fixture.invalid", send: async (message: EmailMessage) => { messages.push(message); return { status: "sent" as const, attemptedAt: new Date(), reference: "fixture" }; } };
const messages: EmailMessage[] = [];
let sequence = 0;
const address = () => `join-${++sequence}@example.invalid`;
before(async () => {
  server = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  Object.assign(process.env, { MONGODB_URI: server.getUri(), MONGODB_DB: "switchplay_test_puckle_registration", SWITCHPLAY_DATABASE_MODE: "disposable",
    SESSION_SECRET: "test-session-secret", ACCOUNT_EMAIL_SECRET: "test-email-key-with-at-least-32-bytes", PUCKLE_FOUNDER_EMAIL: "founder@example.invalid",
    ACCOUNT_EMAIL_PUCKLE_ORIGIN: "http://127.0.0.1:3999", ACCOUNT_EMAIL_PUCKLE_FROM: "Puckle fixture <x@example.invalid>" });
  fixture = createServer((request, response) => {
    let body = ""; request.on("data", chunk => { body += chunk; });
    request.on("end", () => setTimeout(() => { captured.push(JSON.parse(body)); response.setHeader("Content-Type", "application/json"); response.end("{}"); }, fixtureDelayMs));
  });
  fixture.listen(0, "127.0.0.1"); await once(fixture, "listening");
  fixtureOrigin = `http://127.0.0.1:${(fixture.address() as { port: number }).port}`; process.env.ACCOUNT_EMAIL_TEST_ENDPOINT = fixtureOrigin;
  client = await getMongoClient(); db = client.db(process.env.MONGODB_DB); await preparePuckleMembership(db);
});
after(async () => { await client?.close(); await server?.stop(); fixture?.close(); });

const studentDetails = (email: string, extra: Record<string, unknown> = {}) => ({ registrationCategory: "student", name: "Ada", email, mobile: "", phoneCountryCode: "IE",
  dateOfBirth: "2010-05-01", education: { course: "gcse", courseOther: "", level: "higher-tier", levelOther: "" }, ...extra });
const teacherDetails = (email: string, extra: Record<string, unknown> = {}) => ({ registrationCategory: "teacher", name: "Mr Byrne", email, mobile: "", phoneCountryCode: "IE", teacherIntroduction: "", ...extra });
async function proofFor(email: string) {
  const binding = await requestEmailChallenge(db, { email, requester: email }, mail);
  const code = messages.at(-1)!.text.match(/\b\d{6}\b/)![0];
  const { proof } = await verifyEmailChallenge(db, { ...binding, email, code });
  return { ...binding, proof };
}
async function input(details: (email: string) => Record<string, unknown>, extra: Partial<RegistrationInput> = {}) {
  const email = address(); const proof = await proofFor(email);
  return { email, input: { details: details(email), username: `user${sequence}`, password: "a perfectly good passphrase", ...proof, ...extra } satisfies RegistrationInput };
}
const counts = async () => ({ users: await db.collection("users").countDocuments(), memberships: await db.collection("puckleMemberships").countDocuments() });

test("verified student registration creates one ordinary account, one profile and consumes the proof together", async () => {
  const { email, input: request } = await input(studentDetails);
  const outcome = await registerPuckleMember(db, client, request);
  assert.equal(outcome.kind, "created"); if (outcome.kind !== "created") return;
  const user = (await db.collection("users").findOne({ _id: outcome.userId }))!;
  assert.deepEqual([user.cardsData, user.decksData, user.sharedDeckData], [[], [], []]);
  assert.deepEqual(user.permissions, { publicPublishing: false }); assert.equal(user.isAdmin, false); assert.equal(user.sessionVersion, 0);
  assert.equal(user.email, email); assert.equal(user.username, request.username); assert.ok(user.emailVerifiedAt instanceof Date);
  assert.equal(await bcrypt.compare("a perfectly good passphrase", user.passwordHash), true);
  assert.equal(user.passwordHash.startsWith("$2"), true); assert.equal(user.passwordHash.split("$")[2], "12");
  assert.deepEqual({ ...user.safeguarding, dobRecordedAt: undefined }, { dateOfBirth: "2010-05-01", dobSource: "self-declared", ageAssurance: { verification: "none" }, dobRecordedAt: undefined });
  assert.ok(user.safeguarding.dobRecordedAt instanceof Date); assert.equal(user.safeguarding.groupExperienceApproval, undefined);
  const membership = (await db.collection("puckleMemberships").findOne({ userId: outcome.userId }))!;
  assert.equal(membership.registrationCategory, "student"); assert.equal(membership.initialRegistrationSource, "join"); assert.equal(membership.welcome.eligible, true);
  assert.equal(membership.welcome.seenAt, undefined); assert.deepEqual(membership.education, { course: "gcse", courseOther: null, level: "higher-tier", levelOther: null });
  assert.equal(membership.mobile, null); assert.deepEqual(membership.founderNotification, { status: "pending" });
  assert.ok(!JSON.stringify(membership).match(/2010|passwordHash|permissions|approval|assurance/), "profile holds no DOB, credentials, permission or approval data");
  const challenge = (await db.collection("accountEmailChallenges").findOne({ challengeId: request.challengeId }))!;
  assert.ok(challenge.usedAt instanceof Date); assert.ok(!JSON.stringify(challenge).match(/2010|passphrase|Ada|gcse/), "proof record keeps no registration data");
  const session = await readSessionToken(outcome.sessionToken);
  assert.deepEqual([session?.userId, session?.sessionVersion, session?.email, session?.username], [outcome.userId.toHexString(), 0, email, request.username]);
  // Informational only: the founder is told about every new student, but nothing waits on approval.
  assert.equal(typeof outcome.notify, "function"); assert.equal(captured.some(m => m.subject === "Puckle: New student registration" && m.text.includes(String(request.username))), false, "sent after the response, not during registration");
  await outcome.notify!();
  assert.equal((await db.collection("puckleMemberships").findOne({ _id: outcome.membershipId }))!.founderNotification.status, "sent");
  const alert = captured.at(-1)!; assert.equal(alert.subject, "Puckle: New student registration"); assert.deepEqual(alert.to, ["founder@example.invalid"]);
  for (const expected of ["Name: Ada", `Username: ${request.username}`, `Email: ${email}`, "Course: GCSE maths", "Level: higher-tier", "Registered: 20", " UTC", "No approval is needed"]) assert.ok(alert.text.includes(expected), expected);
  assert.ok(!alert.text.match(/passphrase|passwordHash|2010|dateOfBirth|Date of birth|Mobile:/), "no password, hash or date of birth; no mobile line when none was given");
});
test("the student alert includes the mobile number when one was given, never a date of birth", async () => {
  const { input: request } = await input(email => studentDetails(email, { mobile: "+353871234599", education: { course: "a-level", courseOther: "", level: null, levelOther: "" } }));
  const outcome = await registerPuckleMember(db, client, request); assert.equal(outcome.kind, "created"); if (outcome.kind !== "created") return;
  await outcome.notify!(); const text = captured.at(-1)!.text;
  assert.match(text, /Mobile: \+353871234599/); assert.match(text, /Course: A-level maths/); assert.match(text, /Level: Not applicable \(A-level\)/); assert.ok(!text.includes("2010-05-01"));
});
test("A-level students are stored with level null; Other and Don't know keep their answers", async () => {
  const cases: [Record<string, unknown>, Record<string, unknown>][] = [
    [{ course: "a-level", courseOther: "", level: null, levelOther: "" }, { course: "a-level", courseOther: null, level: null, levelOther: null }],
    [{ course: "other", courseOther: "IB", level: "other", levelOther: "SL" }, { course: "other", courseOther: "IB", level: "other", levelOther: "SL" }],
    [{ course: "dont-know", courseOther: "", level: "dont-know", levelOther: "" }, { course: "dont-know", courseOther: null, level: "dont-know", levelOther: null }],
  ];
  for (const [sent, stored] of cases) {
    const { input: request } = await input(email => studentDetails(email, { education: sent }));
    const outcome = await registerPuckleMember(db, client, request); assert.equal(outcome.kind, "created");
    assert.deepEqual((await db.collection("puckleMemberships").findOne({ userId: (outcome as { userId: ObjectId }).userId }))!.education, stored);
  }
});
test("teacher registration: blank introduction works, no DOB or student fields, ordinary rights only, founder alert pending", async () => {
  const { email, input: request } = await input(teacherDetails);
  const before = captured.length;
  const outcome = await registerPuckleMember(db, client, request);
  assert.equal(outcome.kind, "created"); if (outcome.kind !== "created") return;
  const user = (await db.collection("users").findOne({ _id: outcome.userId }))!;
  assert.deepEqual(user.permissions, { publicPublishing: false }); assert.equal(user.isAdmin, false); assert.equal(user.safeguarding, undefined);
  const membership = (await db.collection("puckleMemberships").findOne({ userId: outcome.userId }))!;
  assert.deepEqual([membership.registrationCategory, membership.welcome.eligible, membership.education, membership.teacherIntroduction], ["teacher", false, undefined, undefined]);
  assert.deepEqual(membership.founderNotification, { status: "pending" });
  assert.equal(captured.length, before, "the alert is not sent inside the registration");
  await outcome.notify!();
  assert.equal((await db.collection("puckleMemberships").findOne({ _id: outcome.membershipId }))!.founderNotification.status, "sent");
  const alert = captured.at(-1)!;
  assert.deepEqual(alert.to, ["founder@example.invalid"]); assert.match(alert.text, new RegExp(email)); assert.match(alert.text, /No introduction given/);
  assert.ok(!alert.text.match(/passphrase|passwordHash/));
  const introduced = await input(email => teacherDetails(email, { teacherIntroduction: "I teach Junior Cycle.", mobile: "+353871234567" }));
  const second = await registerPuckleMember(db, client, introduced.input); assert.equal(second.kind, "created");
  const profile = (await db.collection("puckleMemberships").findOne({ userId: (second as { userId: ObjectId }).userId }))!;
  assert.deepEqual([profile.teacherIntroduction, profile.mobile], ["I teach Junior Cycle.", "+353871234567"]);
});
test("new accounts cannot publish publicly: the permissions guard denies them while private capability data exists", async () => {
  const { input: request } = await input(studentDetails);
  const outcome = await registerPuckleMember(db, client, request); assert.equal(outcome.kind, "created"); if (outcome.kind !== "created") return;
  await assert.rejects(withMongoTransaction(client, session => requirePublicPublishing(db, outcome.userId.toHexString(), session)), /PUBLIC_PUBLISHING_FORBIDDEN/);
});
test("registration without a verified, matching, unexpired and unused proof creates nothing", async () => {
  const startedWith = await counts();
  const good = await input(studentDetails);
  const cases: [string, RegistrationInput][] = [
    ["missing proof", { ...good.input, proof: undefined }], ["garbage proof", { ...good.input, proof: "x".repeat(43) }],
    ["other flow", { ...good.input, flowToken: "f".repeat(43) }], ["other email", { ...good.input, details: studentDetails(address()) }],
  ];
  const email = address(), binding = await requestEmailChallenge(db, { email, requester: email }, mail);
  cases.push(["code never verified", { ...good.input, details: studentDetails(email), ...binding, proof: "p".repeat(43) }]);
  for (const [label, request] of cases) assert.equal((await registerPuckleMember(db, client, request)).kind, "proof", label);
  await db.collection("accountEmailChallenges").updateOne({ challengeId: good.input.challengeId as string }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
  assert.equal((await registerPuckleMember(db, client, good.input)).kind, "proof", "expired proof");
  assert.deepEqual(await counts(), startedWith);
});
test("an invalid proof never causes password hashing work", async () => {
  let prepared = 0; const spy = async (...args: Parameters<typeof prepareAccountCredentials>) => { prepared += 1; return prepareAccountCredentials(...args); };
  const good = await input(studentDetails);
  await registerPuckleMember(db, client, { ...good.input, proof: "z".repeat(43) }, { prepare: spy });
  assert.equal(prepared, 0);
  assert.equal((await registerPuckleMember(db, client, good.input, { prepare: spy })).kind, "created"); assert.equal(prepared, 1);
});
test("a proof can be used once; replaying it cannot create or sign into anything", async () => {
  const good = await input(studentDetails);
  assert.equal((await registerPuckleMember(db, client, good.input)).kind, "created");
  const before = await counts();
  assert.equal((await registerPuckleMember(db, client, { ...good.input, username: "another_name" })).kind, "proof");
  assert.deepEqual(await counts(), before);
});
test("two concurrent registrations with one proof produce exactly one account", async () => {
  const good = await input(studentDetails), before = await counts();
  const results = await Promise.all([registerPuckleMember(db, client, good.input), registerPuckleMember(db, client, { ...good.input, username: `${good.input.username}2` })]);
  assert.deepEqual(results.map(result => result.kind).sort(), ["created", "proof"]);
  assert.deepEqual(await counts(), { users: before.users + 1, memberships: before.memberships + 1 });
});
test("a taken username is reported on its field, rolls everything back and leaves the proof reusable", async () => {
  await db.collection("users").insertOne({ _id: new ObjectId(), email: address(), username: "TakenName", passwordHash: "x", cardsData: [], decksData: [], createdAt: new Date(), updatedAt: new Date() });
  const good = await input(studentDetails, { username: "TakenName" }), before = await counts();
  assert.deepEqual(await registerPuckleMember(db, client, good.input), { kind: "conflict", field: "username" });
  assert.deepEqual(await counts(), before);
  assert.equal((await db.collection("accountEmailChallenges").findOne({ challengeId: good.input.challengeId as string }))!.usedAt, undefined);
  assert.equal((await registerPuckleMember(db, client, { ...good.input, username: "takenname" })).kind, "created", "usernames are case-sensitive and the same proof still works");
});
test("an email taken after verification yields neutral conflict without touching the existing account or consuming the proof", async () => {
  const good = await input(studentDetails), email = (good.input.details as { email: string }).email;
  const existing = { _id: new ObjectId(), email, username: "ExistingOwner", passwordHash: await bcrypt.hash("owners secret", 4), cardsData: [{ keep: 1 }], decksData: [], permissions: { publicPublishing: true }, createdAt: new Date(), updatedAt: new Date() };
  await db.collection("users").insertOne(existing); const before = await counts();
  assert.deepEqual(await registerPuckleMember(db, client, good.input), { kind: "conflict", field: "email" });
  assert.deepEqual(await counts(), before);
  assert.deepEqual(await db.collection("users").findOne({ _id: existing._id }), existing, "the existing account is untouched");
  assert.equal((await db.collection("accountEmailChallenges").findOne({ challengeId: good.input.challengeId as string }))!.usedAt, undefined);
});
test("a failure while writing the profile rolls back the account and proof", async () => {
  const good = await input(studentDetails), before = await counts();
  const sabotage = async (...args: Parameters<typeof prepareAccountCredentials>) => {
    const prepared = await prepareAccountCredentials(...args);
    await db.collection("puckleMemberships").insertOne({ userId: prepared.document._id, name: "squatter" }); // forces a unique-index failure on the profile insert
    return prepared;
  };
  await assert.rejects(registerPuckleMember(db, client, good.input, { prepare: sabotage }));
  assert.deepEqual(await counts(), { users: before.users, memberships: before.memberships + 1 }, "only the saboteur row exists");
  assert.equal(await db.collection("users").findOne({ email: (good.input.details as { email: string }).email }), null);
  assert.equal((await db.collection("accountEmailChallenges").findOne({ challengeId: good.input.challengeId as string }))!.usedAt, undefined);
  assert.equal((await registerPuckleMember(db, client, good.input)).kind, "created", "the proof survived the rollback");
});
test("session-signing failure happens before any write", async () => {
  const good = await input(studentDetails), before = await counts(), secret = process.env.SESSION_SECRET;
  delete process.env.SESSION_SECRET;
  try { await assert.rejects(registerPuckleMember(db, client, good.input), /SESSION_SECRET/); } finally { process.env.SESSION_SECRET = secret; }
  assert.deepEqual(await counts(), before);
  assert.equal((await db.collection("accountEmailChallenges").findOne({ challengeId: good.input.challengeId as string }))!.usedAt, undefined);
});
test("authoritative validation rejects under-13s, tampered authority fields and bad credentials without writing", async () => {
  const before = await counts(), now = new Date("2026-11-14T12:00:00Z");
  const attempt = async (label: string, details: (email: string) => Record<string, unknown>, expected: string, extra: Partial<RegistrationInput> = {}) => {
    const { input: request } = await input(details, extra);
    assert.deepEqual(await registerPuckleMember(db, client, request, { now }), { kind: "invalid", code: expected }, label);
  };
  await attempt("under 13 (day before 13th birthday)", email => studentDetails(email, { dateOfBirth: "2013-11-15" }), "MINIMUM_AGE_13");
  await attempt("future date", email => studentDetails(email, { dateOfBirth: "2027-01-01" }), "FUTURE_DATE_OF_BIRTH");
  await attempt("impossible date", email => studentDetails(email, { dateOfBirth: "2010-02-30" }), "INVALID_DATE_OF_BIRTH");
  await attempt("permission smuggled in", email => studentDetails(email, { permissions: { publicPublishing: true } }), "UNEXPECTED_FIELD");
  await attempt("admin smuggled in", email => teacherDetails(email, { isAdmin: true }), "UNEXPECTED_FIELD");
  await attempt("safeguarding smuggled in", email => studentDetails(email, { safeguarding: { ageAssurance: { verification: "independent" } } }), "UNEXPECTED_FIELD");
  await attempt("teacher with DOB", email => teacherDetails(email, { dateOfBirth: "2000-01-01" }), "INCOMPATIBLE_CATEGORY_FIELDS");
  await attempt("A-level with a level", email => studentDetails(email, { education: { course: "a-level", courseOther: "", level: "higher", levelOther: "" } }), "A_LEVEL_HAS_NO_LEVEL");
  await attempt("Other without text", email => studentDetails(email, { education: { course: "other", courseOther: "", level: "other", levelOther: "x" } }), "INVALID_TEXT");
  await attempt("level from the wrong course", email => studentDetails(email, { education: { course: "gcse", courseOther: "", level: "ordinary", levelOther: "" } }), "INVALID_LEVEL");
  await attempt("short username", email => studentDetails(email), "INVALID_USERNAME", { username: "ab" });
  await attempt("username with @", email => studentDetails(email), "INVALID_USERNAME", { username: "a@b.com" });
  await attempt("short password", email => studentDetails(email), "INVALID_NEW_PASSWORD", { password: "elevenchars" });
  await attempt("73-byte password", email => studentDetails(email), "INVALID_NEW_PASSWORD", { password: "p".repeat(73) });
  await attempt("invalid mobile", email => studentDetails(email, { mobile: "12" }), "INVALID_MOBILE");
  assert.deepEqual(await counts(), before);
  const exactlyThirteen = await input(email => studentDetails(email, { dateOfBirth: "2013-11-14" }));
  assert.equal((await registerPuckleMember(db, client, exactlyThirteen.input, { now })).kind, "created", "13th birthday today is allowed");
});
test("registrations leave pre-existing accounts exactly as they were", async () => {
  const legacy = { _id: new ObjectId(), email: address(), username: "LegacyUser", passwordHash: await bcrypt.hash("old", 4), cardsData: [{ a: 1 }], decksData: [{ b: 2 }], sharedDeckData: [], createdAt: new Date(0), updatedAt: new Date(0) };
  await db.collection("users").insertOne(legacy);
  for (const details of [studentDetails, teacherDetails]) assert.equal((await registerPuckleMember(db, client, (await input(details)).input)).kind, "created");
  assert.deepEqual(await db.collection("users").findOne({ _id: legacy._id }), legacy);
  assert.equal(await db.collection("puckleMemberships").findOne({ userId: legacy._id }), null);
});

test("no-email requests are contact records only: no account, profile, credential or username reservation", async () => {
  const before = await counts(), usersBefore = JSON.stringify(await db.collection("users").find().sort({ _id: 1 }).toArray());
  const student = await saveNoEmailJoinContact(db, { registrationCategory: "student", name: "Sam", email: "", mobile: "087 123 4567", phoneCountryCode: "IE", dateOfBirth: "2010-05-01",
    education: { course: "a-level", courseOther: "", level: null, levelOther: "" } });
  const teacher = await saveNoEmailJoinContact(db, { registrationCategory: "teacher", name: "Ms Lee", email: "", mobile: "+353871234568", teacherIntroduction: "" });
  assert.deepEqual(await counts(), before);
  assert.equal(JSON.stringify(await db.collection("users").find().sort({ _id: 1 }).toArray()), usersBefore);
  const saved = (await db.collection("puckleJoinContactRequests").findOne({ _id: student.id }))!;
  assert.deepEqual([saved.kind, saved.noEmailReason, saved.registrationCategory, saved.mobile, saved.submittedDateOfBirth], ["no-email-join-request", "no-email-address", "student", "+353871234567", "2010-05-01"]);
  assert.deepEqual(saved.education, { course: "a-level", courseOther: null, level: null, levelOther: null }); assert.deepEqual(saved.founderNotification, { status: "pending" });
  assert.deepEqual(Object.keys(saved).filter(key => /^(password|passwordHash|username|email|userId|permissions)$/i.test(key)), [], "no credential or account fields");
  const teacherRow = (await db.collection("puckleJoinContactRequests").findOne({ _id: teacher.id }))!;
  assert.equal(teacherRow.submittedDateOfBirth, undefined); assert.equal(teacherRow.registrationCategory, "teacher");
  await teacher.notify();
  assert.equal((await db.collection("puckleJoinContactRequests").findOne({ _id: teacher.id }))!.founderNotification.status, "sent");
  assert.match(captured.at(-1)!.text, /no account was created/i); assert.match(captured.at(-1)!.text, /Ms Lee/);
});
test("no-email requests reject credentials, an email, a missing mobile, under-13s and unexpected fields; nothing is stored", async () => {
  const before = await db.collection("puckleJoinContactRequests").countDocuments();
  const base = { registrationCategory: "teacher", name: "T", email: "", mobile: "+353871234567", phoneCountryCode: "IE", teacherIntroduction: "" };
  const reject = async (label: string, body: Record<string, unknown>, code: string) => await assert.rejects(saveNoEmailJoinContact(db, body), new RegExp(code), label);
  await reject("password", { ...base, password: "secret" }, "UNEXPECTED_FIELD"); await reject("username", { ...base, username: "someone" }, "UNEXPECTED_FIELD");
  await reject("passwordHash", { ...base, passwordHash: "x" }, "UNEXPECTED_FIELD"); await reject("email supplied", { ...base, email: "a@b.com" }, "NO_EMAIL_REQUIRES_MOBILE");
  await reject("no mobile", { ...base, mobile: "" }, "NO_EMAIL_REQUIRES_MOBILE"); await reject("bad mobile", { ...base, mobile: "12" }, "INVALID_MOBILE");
  await reject("under 13", { ...base, registrationCategory: "student", dateOfBirth: "2020-01-01", education: { course: "gcse", level: "higher-tier" }, teacherIntroduction: undefined }, "MINIMUM_AGE_13");
  await reject("student without course", { ...base, registrationCategory: "student", dateOfBirth: "2010-01-01", teacherIntroduction: undefined }, "SUBMISSION|COURSE");
  assert.equal(await db.collection("puckleJoinContactRequests").countDocuments(), before);
});
test("interest contacts never create accounts and record the email-updates choice only when explicit", async () => {
  const before = await counts(), existing = address();
  await db.collection("users").insertOne({ _id: new ObjectId(), email: existing, username: "InterestedAlready", passwordHash: "x", cardsData: [], decksData: [], createdAt: new Date(), updatedAt: new Date() });
  const interested = await saveInterestContact(db, { name: "Pat", email: existing, mobile: "", phoneCountryCode: "IE", reason: "parent", message: "" }, new Date("2026-11-14T10:00:00Z"));
  const declined = await saveInterestContact(db, { name: "Quinn", email: "q@example.invalid", mobile: "+353871234569", phoneCountryCode: "IE", reason: "", message: "" });
  const mobileOnly = await saveInterestContact(db, { name: "Rae", email: "", mobile: "+353871234570", phoneCountryCode: "IE", reason: "curious", message: "" });
  const rows = Object.fromEntries(await Promise.all([["interested", interested], ["declined", declined], ["mobileOnly", mobileOnly]].map(async ([name, saved]) => [name, (await db.collection("puckleInterestContacts").findOne({ _id: (saved as typeof interested).id }))!])));
  assert.equal((await counts()).users, before.users + 1, "only the fixture user above"); assert.equal((await counts()).memberships, before.memberships);
  assert.deepEqual([rows.interested.communication.emailUpdates, rows.interested.communication.wordingVersion, rows.interested.communication.recordedAt.toISOString()], [true, "puckle-updates-signup-v1", "2026-11-14T10:00:00.000Z"]);
  assert.equal(rows.declined.communication.emailUpdates, true, "submitting with an email is the request"); assert.equal(rows.mobileOnly.communication.emailUpdates, false, "mobile-only: follow-up only");
  assert.deepEqual([rows.interested.communication.source, rows.declined.reason], ["join-interest-form", ""]);
  assert.deepEqual([rows.mobileOnly.email, rows.mobileOnly.mobile], [null, "+353871234570"]);
  assert.ok(!JSON.stringify(rows).match(/sms|password|userId/i));
  await assert.rejects(saveInterestContact(db, { name: "X", email: "", mobile: "+353871234570", reason: "r", emailUpdates: true }), /UNEXPECTED_FIELD/);
  await assert.rejects(saveInterestContact(db, { name: "X", email: "", mobile: "", reason: "r" }), /CONTACT_REQUIRED/);
  await saveInterestContact(db, { name: "X", email: "a@b.com", reason: "", mobile: "" }); // reason is optional
  await assert.rejects(saveInterestContact(db, { name: "X", email: "a@b.com", reason: "r", password: "nope" }), /UNEXPECTED_FIELD/);
  await mobileOnly.notify();
  assert.match(captured.at(-1)!.text, /No account was created/); assert.match(captured.at(-1)!.text, /Rae/); assert.match(captured.at(-1)!.text, /follow-up only/);
});
test("founder notification outcomes are recorded and never throw or alter the saved record", async () => {
  const saved = await saveNoEmailJoinContact(db, { registrationCategory: "teacher", name: "N", email: "", mobile: "+353871234571", teacherIntroduction: "" });
  const target = { collection: "puckleJoinContactRequests", id: saved.id }, status = async () => (await db.collection("puckleJoinContactRequests").findOne({ _id: saved.id }))!;
  const message = { subject: "s", text: "t" };
  await notifyFounder(db, target, message, async () => ({ status: "failed", attemptedAt: new Date(), reference: "provider-http-500" }));
  assert.deepEqual([(await status()).founderNotification.status, (await status()).founderNotification.reference], ["failed", "provider-http-500"]);
  await notifyFounder(db, target, message, async () => { throw new Error("secret-provider-payload"); });
  assert.equal((await status()).founderNotification.status, "unknown"); assert.ok(!JSON.stringify(await status()).includes("secret-provider-payload"));
  const configured = process.env.PUCKLE_FOUNDER_EMAIL; delete process.env.PUCKLE_FOUNDER_EMAIL;
  try { await notifyFounder(db, target, message); } finally { process.env.PUCKLE_FOUNDER_EMAIL = configured; }
  assert.deepEqual([(await status()).founderNotification.status, (await status()).founderNotification.reference], ["failed", "founder-email-not-configured"]);
  assert.equal((await status()).name, "N", "the saved submission is unchanged");
  await notifyFounder(db, { collection: "puckleJoinContactRequests", id: new ObjectId() }, message, async () => { throw new Error("x"); }); // unknown record: still no throw
});
test("a slow founder alert does not delay or affect the saved registration, and a missing callback leaves it findable as pending", async () => {
  const { input: request } = await input(teacherDetails);
  const started = Date.now(); fixtureDelayMs = 600;
  try {
    const outcome = await registerPuckleMember(db, client, request);
    assert.ok(Date.now() - started < 590 + 2000, "registration did not wait for the alert"); assert.equal(outcome.kind, "created"); if (outcome.kind !== "created") return;
    assert.equal((await db.collection("puckleMemberships").findOne({ _id: outcome.membershipId }))!.founderNotification.status, "pending");
    const pending = await db.collection("puckleMemberships").find({ "founderNotification.status": "pending" }).sort({ createdAt: 1 }).toArray();
    assert.ok(pending.some(row => row._id.equals(outcome.membershipId)), "retrievable by the documented status/date query");
    const alert = outcome.notify!(); assert.equal((await db.collection("puckleMemberships").findOne({ _id: outcome.membershipId }))!.founderNotification.status, "pending");
    await alert; assert.equal((await db.collection("puckleMemberships").findOne({ _id: outcome.membershipId }))!.founderNotification.status, "sent");
  } finally { fixtureDelayMs = 0; }
});

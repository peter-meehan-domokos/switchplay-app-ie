import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { once } from "node:events";
import { after, before, test } from "node:test";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { MongoClient, ObjectId, type Db } from "mongodb";
import { resolveTuitionContext, saveTuitionEnquiry } from "../src/lib/puckleEnquiries";
import type { AuthUser } from "../src/lib/auth";

let server: MongoMemoryReplSet, client: MongoClient, db: Db, fixture: Server;
const captured: { to: string[]; subject: string; text: string }[] = [];
const NOW = new Date("2026-11-14T12:00:00Z");
before(async () => {
  server = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  Object.assign(process.env, { MONGODB_URI: server.getUri(), MONGODB_DB: "switchplay_test_puckle_tuition", SWITCHPLAY_DATABASE_MODE: "disposable",
    PUCKLE_FOUNDER_EMAIL: "founder@example.invalid", ACCOUNT_EMAIL_PUCKLE_ORIGIN: "http://127.0.0.1:3999", ACCOUNT_EMAIL_PUCKLE_FROM: "Puckle fixture <x@example.invalid>" });
  fixture = createServer((request, response) => { let body = ""; request.on("data", c => { body += c; }); request.on("end", () => { captured.push(JSON.parse(body)); response.end("{}"); }); });
  fixture.listen(0, "127.0.0.1"); await once(fixture, "listening");
  process.env.ACCOUNT_EMAIL_TEST_ENDPOINT = `http://127.0.0.1:${(fixture.address() as { port: number }).port}`;
  client = await new MongoClient(server.getUri()).connect(); db = client.db(process.env.MONGODB_DB);
});
after(async () => { await client?.close(); await server?.stop(); fixture?.close(); });

let n = 0;
async function member(options: { dob?: string; category?: "student" | "teacher"; profile?: boolean; course?: string; mobile?: string | null } = {}) {
  const _id = new ObjectId(), email = `tuition-${++n}@example.invalid`;
  const user = { _id, email, username: `T${n}`, passwordHash: "hash", cardsData: [{ keep: n }], decksData: [], sharedDeckData: [], permissions: { publicPublishing: false },
    ...(options.dob ? { safeguarding: { dateOfBirth: options.dob, dobSource: "self-declared", dobRecordedAt: NOW, ageAssurance: { verification: "none" } } } : {}), createdAt: NOW, updatedAt: NOW };
  await db.collection("users").insertOne(user);
  const membershipId = new ObjectId();
  if (options.profile !== false) await db.collection("puckleMemberships").insertOne({ _id: membershipId, userId: _id, name: "Aoife", registrationCategory: options.category ?? "student", mobile: options.mobile === undefined ? "+353871234567" : options.mobile,
    education: { course: options.course ?? "gcse", courseOther: null, level: "higher-tier", levelOther: null }, initialRegistrationSource: "join", welcome: { eligible: true }, createdAt: NOW, updatedAt: NOW });
  const auth: AuthUser = { id: _id.toHexString(), email, username: `T${n}`, isAdmin: false, createdAt: NOW.toISOString(), updatedAt: NOW.toISOString() };
  return { _id, membershipId, auth, user };
}
const guardian = { enquirerType: "student-under-18", studentName: "Aoife", contactName: "Mary Murphy", mathsCourse: "gcse", email: "mary@example.invalid", preferredContactMethod: "email" };
const adult = { enquirerType: "student-adult", contactName: "Sam", mathsCourse: "gcse", phone: "+353871234568", preferredContactMethod: "text" };
const snapshot = async () => JSON.stringify([await db.collection("users").find().sort({ _id: 1 }).toArray(), await db.collection("puckleMemberships").find().sort({ _id: 1 }).toArray()]);

test("visitors without accounts: every enquirer type is saved unlinked, pending alert, and nothing else is created", async () => {
  const before = await snapshot();
  for (const body of [guardian, adult, { enquirerType: "parent-guardian", contactName: "Pat", studentName: "Jamie", mathsCourse: "a-level", phone: "+353861234567", preferredContactMethod: "phone" }]) {
    const result = await saveTuitionEnquiry(db, body, null, NOW); assert.equal(result.ok, true); if (!result.ok) return;
    const row = (await db.collection("puckleTuitionEnquiries").findOne({ _id: result.id }))!;
    assert.deepEqual(row.founderNotification, { status: "pending" }); assert.equal(row.userId, undefined); assert.equal(row.membershipId, undefined); assert.equal(row.source, "public-homepage");
  }
  assert.equal(await snapshot(), before, "no user or membership created or changed");
});
test("an invalid enquiry stores nothing and reports field errors", async () => {
  const count = await db.collection("puckleTuitionEnquiries").countDocuments();
  const result = await saveTuitionEnquiry(db, { ...guardian, email: "", phone: "" }, null, NOW);
  assert.equal(result.ok, false); if (result.ok) return; assert.ok(result.fieldErrors.contact);
  assert.equal(await db.collection("puckleTuitionEnquiries").countDocuments(), count);
});
test("a signed-in under-18 is derived from the stored DOB: a forged adult payload cannot skip guardian requirements", async () => {
  const student = await member({ dob: "2010-03-01" });
  assert.equal((await resolveTuitionContext(db, student.auth, "2026-11-14")).context.mode, "student-under-18");
  const forged = await saveTuitionEnquiry(db, adult, student.auth, NOW);
  assert.equal(forged.ok, false); if (!forged.ok) assert.ok(forged.fieldErrors.studentName, "needs the student's first name and a guardian contact name as under-18");
  const noGuardianName = await saveTuitionEnquiry(db, { ...adult, studentName: "Aoife", contactName: "" }, student.auth, NOW);
  assert.equal(noGuardianName.ok, false); if (!noGuardianName.ok) assert.ok(noGuardianName.fieldErrors.contactName);
  const before = JSON.stringify(await db.collection("users").findOne({ _id: student._id }));
  const ok = await saveTuitionEnquiry(db, { ...guardian, enquirerType: "student-adult" }, student.auth, NOW);
  assert.equal(ok.ok, true); if (!ok.ok) return;
  const row = (await db.collection("puckleTuitionEnquiries").findOne({ _id: ok.id }))!;
  assert.deepEqual([row.enquirerType, row.contactRelationship, row.contactName, row.studentName], ["student-under-18", "parent-guardian", "Mary Murphy", "Aoife"]);
  assert.deepEqual([row.userId, row.membershipId], [student._id, student.membershipId]);
  assert.equal(JSON.stringify(await db.collection("users").findOne({ _id: student._id })), before, "account, DOB and learning data untouched");
});
test("the 18th birthday decides the path (today vs the day before)", async () => {
  const turned = await member({ dob: "2008-11-14" }), almost = await member({ dob: "2008-11-15" });
  assert.equal((await resolveTuitionContext(db, turned.auth, "2026-11-14")).context.mode, "student-adult");
  assert.equal((await resolveTuitionContext(db, almost.auth, "2026-11-14")).context.mode, "student-under-18");
  const saved = await saveTuitionEnquiry(db, { ...adult, enquirerType: "student-under-18", studentName: "Aoife", contactName: "Sam" }, turned.auth, NOW);
  assert.equal(saved.ok, true); if (saved.ok) assert.equal((await db.collection("puckleTuitionEnquiries").findOne({ _id: saved.id }))!.enquirerType, "student-adult");
});
test("context for under-18 never carries the student's own login email or mobile; adults get editable prefill; Other and Don't know map correctly", async () => {
  const minor = await member({ dob: "2012-01-01", course: "a-level" }), grown = await member({ dob: "1990-01-01", course: "other" }), unsure = await member({ dob: "2000-01-01", course: "dont-know", mobile: null });
  const m = (await resolveTuitionContext(db, minor.auth, "2026-11-14")).context;
  assert.deepEqual(m, { mode: "student-under-18", studentName: "Aoife", mathsCourse: "a-level" }); assert.ok(!JSON.stringify(m).match(/example\.invalid|\+353|2012/));
  assert.deepEqual((await resolveTuitionContext(db, grown.auth)).context, { mode: "student-adult", name: "Aoife", mathsCourse: "other", email: grown.auth.email, phone: "+353871234567" });
  const u = (await resolveTuitionContext(db, unsure.auth)).context; assert.deepEqual([u.mode, (u as { mathsCourse: unknown }).mathsCourse, (u as { phone: unknown }).phone], ["student-adult", null, null]);
});
test("unknown DOB, no Puckle profile, teachers and anonymous keep the original flow and are never linked", async () => {
  const cases = [await member({}), await member({ dob: "2010-01-01", profile: false }), await member({ dob: "2010-01-01", category: "teacher" })];
  for (const person of cases) {
    assert.equal((await resolveTuitionContext(db, person.auth)).context.mode, "unknown");
    const saved = await saveTuitionEnquiry(db, adult, person.auth, NOW); assert.equal(saved.ok, true);
    if (saved.ok) { const row = (await db.collection("puckleTuitionEnquiries").findOne({ _id: saved.id }))!; assert.equal(row.enquirerType, "student-adult"); assert.equal(row.userId, undefined); }
  }
  assert.equal((await resolveTuitionContext(db, null)).context.mode, "unknown");
});
test("a signed-in student can still enquire as a parent/guardian: kept as such and not linked to the account", async () => {
  const student = await member({ dob: "2010-01-01" });
  const saved = await saveTuitionEnquiry(db, { enquirerType: "parent-guardian", contactName: "Pat", studentName: "Jamie", mathsCourse: "gcse", email: "pat@example.invalid", preferredContactMethod: "email" }, student.auth, NOW);
  assert.equal(saved.ok, true); if (!saved.ok) return;
  const row = (await db.collection("puckleTuitionEnquiries").findOne({ _id: saved.id }))!; assert.deepEqual([row.enquirerType, row.userId], ["parent-guardian", undefined]);
});
test("siblings sharing contact details produce independent enquiries", async () => {
  const before = await db.collection("puckleTuitionEnquiries").countDocuments({ email: "shared@example.invalid" });
  for (const studentName of ["Una", "Ben"]) assert.equal((await saveTuitionEnquiry(db, { ...guardian, studentName, email: "shared@example.invalid" }, null, NOW)).ok, true);
  assert.equal(await db.collection("puckleTuitionEnquiries").countDocuments({ email: "shared@example.invalid" }), before + 2);
});
test("founder alert: sent outcome, readable content, no account claim; failure and missing config are recorded without changing the enquiry", async () => {
  const saved = await saveTuitionEnquiry(db, guardian, null, NOW); assert.equal(saved.ok, true); if (!saved.ok) return;
  assert.equal(captured.some(m => m.text.includes("Mary Murphy")), false, "nothing is sent while saving");
  await saved.notify();
  assert.equal((await db.collection("puckleTuitionEnquiries").findOne({ _id: saved.id }))!.founderNotification.status, "sent");
  const mail = captured.at(-1)!; assert.match(mail.subject, /^\[ACTION\] 📩 TUITION ENQUIRY: /); assert.match(mail.text, /Mary Murphy/); assert.match(mail.text, /Nothing is booked/); assert.match(mail.text, new RegExp(saved.id.toHexString()));
  const second = await saveTuitionEnquiry(db, guardian, null, NOW); assert.equal(second.ok, true); if (!second.ok) return;
  const configured = process.env.PUCKLE_FOUNDER_EMAIL; delete process.env.PUCKLE_FOUNDER_EMAIL;
  try { await second.notify(); } finally { process.env.PUCKLE_FOUNDER_EMAIL = configured; }
  const row = (await db.collection("puckleTuitionEnquiries").findOne({ _id: second.id }))!;
  assert.deepEqual([row.founderNotification.status, row.founderNotification.reference, row.contactName], ["failed", "founder-email-not-configured", "Mary Murphy"]);
  const pending = await db.collection("puckleTuitionEnquiries").countDocuments({ "founderNotification.status": "pending" }); assert.ok(pending >= 1, "undelivered alerts stay findable");
});

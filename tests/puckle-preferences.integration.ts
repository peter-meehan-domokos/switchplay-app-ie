import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { MongoClient, ObjectId, type Db } from "mongodb";
import { isOptedIn } from "../src/app/sites/puckle/lib/communicationPreferences";
import { getMongoClient } from "../src/lib/mongodb";
import { saveInterestContact } from "../src/lib/puckleJoinContacts";
import { idFromManageToken, loadInterestPreferences, loadMemberPreferences, manageToken, saveInterestPreferences, saveMemberPreferences } from "../src/lib/puckleCommunicationPreferences";

let server: MongoMemoryReplSet, client: MongoClient, db: Db;
before(async () => {
  server = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  Object.assign(process.env, { MONGODB_URI: server.getUri(), MONGODB_DB: "switchplay_test_puckle_preferences", SWITCHPLAY_DATABASE_MODE: "disposable",
    SESSION_SECRET: "test-session-secret", ACCOUNT_EMAIL_SECRET: "test-email-key-with-at-least-32-bytes", PUCKLE_FOUNDER_EMAIL: "founder@example.invalid",
    ACCOUNT_EMAIL_PUCKLE_ORIGIN: "http://127.0.0.1:3999", ACCOUNT_EMAIL_PUCKLE_FROM: "Puckle fixture <x@example.invalid>" });
  client = await getMongoClient(); db = client.db(process.env.MONGODB_DB);
});
after(async () => { await client?.close(); await server?.stop(); });

const SHARED = ["puckleUpdates", "newsAndOffers", "occasionalPersonalContact"];
const prefs = (keys: string[], value: "yes" | "no", channels = { email: false, sms: false }) => ({ answers: Object.fromEntries(keys.map(key => [key, value])), channels });
let sequence = 0;
async function member(category: "student" | "teacher", extra: Record<string, unknown> = {}) {
  const _id = new ObjectId(), now = new Date(); sequence += 1;
  await db.collection("users").insertOne({ _id, email: `settings-${sequence}@example.invalid`, username: `Settings${sequence}`, passwordHash: "x", cardsData: [], decksData: [], createdAt: now, updatedAt: now });
  await db.collection("puckleMemberships").insertOne({ userId: _id, name: "Niamh", registrationCategory: category, mobile: null, initialRegistrationSource: "join", welcome: { eligible: false }, createdAt: now, updatedAt: now, ...extra });
  return _id;
}
const membershipOf = (userId: ObjectId) => db.collection("puckleMemberships").findOne({ userId });
const ALL_STUDENT = [...SHARED, "guidedMathsInvitations"], ALL_TEACHER = [...SHARED, "teacherCollaborationInvitations"];

test("settings: existing members start unknown and load their audience", async () => {
  const student = await member("student"), teacher = await member("teacher");
  assert.deepEqual(await loadMemberPreferences(db, student), { audience: "student", stored: null, hasMobile: false });
  assert.equal((await loadMemberPreferences(db, teacher))!.audience, "teacher");
  assert.equal(await loadMemberPreferences(db, new ObjectId()), null, "no membership, nothing to edit");
  assert.equal((await membershipOf(student))!.communicationPreferences, undefined, "never migrated to opted in");
});
test("settings: choices save, persist and can be changed, opting out included", async () => {
  const id = await member("student"), now = new Date("2026-11-19T09:00:00Z");
  const saved = await saveMemberPreferences(db, id, { communicationPreferences: { answers: { ...prefs(ALL_STUDENT, "no").answers, puckleUpdates: "yes" }, channels: { email: true, sms: false } } }, now);
  assert.deepEqual([saved.source, saved.wordingVersion, saved.recordedAt, saved.channels], ["account-settings", "puckle-communication-preferences-v2", now, { email: true, sms: false }]);
  const row = (await membershipOf(id))!;
  assert.equal(row.communicationPreferences.answers.puckleUpdates, "yes"); assert.equal(row.updatedAt.toISOString(), now.toISOString());
  assert.equal(isOptedIn(row.communicationPreferences, "puckleUpdates", "email"), true);
  assert.deepEqual((await loadMemberPreferences(db, id))!.stored!.answers, row.communicationPreferences.answers);
  await saveMemberPreferences(db, id, { communicationPreferences: prefs(ALL_STUDENT, "no") });
  const out = (await membershipOf(id))!;
  assert.equal(isOptedIn(out.communicationPreferences, "puckleUpdates", "email"), false, "opt-out takes effect for recipient selection");
  assert.deepEqual(out.communicationPreferences.channels, { email: false, sms: false });
});
test("settings: Text needs a mobile, which can be added once; an existing number is never replaced", async () => {
  const id = await member("student"), body = (mobile?: string) => ({ communicationPreferences: { answers: { ...prefs(ALL_STUDENT, "no").answers, newsAndOffers: "yes" }, channels: { email: false, sms: true } }, ...(mobile ? { mobile, phoneCountryCode: "IE" } : {}) });
  await assert.rejects(saveMemberPreferences(db, id, body()), /SMS_CHANNEL_NEEDS_MOBILE/);
  await assert.rejects(saveMemberPreferences(db, id, body("12")), /INVALID_MOBILE/);
  assert.equal((await membershipOf(id))!.communicationPreferences, undefined, "a rejected save changes nothing");
  await saveMemberPreferences(db, id, body("+353871234567"));
  const row = (await membershipOf(id))!;
  assert.deepEqual([row.mobile, row.communicationPreferences.channels.sms], ["+353871234567", true]);
  await saveMemberPreferences(db, id, body("+353879999999"));
  assert.equal((await membershipOf(id))!.mobile, "+353871234567", "an existing number is kept");
});
test("settings: only the account's own record changes, with the audience's own choices", async () => {
  const mine = await member("teacher"), other = await member("student");
  await assert.rejects(saveMemberPreferences(db, mine, { communicationPreferences: prefs(ALL_STUDENT, "no") }), /PREFERENCES_INVALID/);
  await assert.rejects(saveMemberPreferences(db, mine, { communicationPreferences: prefs(SHARED, "no") }), /PREFERENCES_INVALID|PREFERENCES_INCOMPLETE/);
  await assert.rejects(saveMemberPreferences(db, mine, { communicationPreferences: prefs(ALL_TEACHER, "no"), userId: other.toHexString() }), /PREFERENCES_INVALID/);
  await assert.rejects(saveMemberPreferences(db, new ObjectId(), { communicationPreferences: prefs(ALL_TEACHER, "no") }), /NO_MEMBERSHIP/);
  await saveMemberPreferences(db, mine, { communicationPreferences: prefs(ALL_TEACHER, "yes", { email: true, sms: false }) });
  assert.equal((await membershipOf(other))!.communicationPreferences, undefined, "another member is untouched");
  assert.equal((await membershipOf(mine))!.communicationPreferences.answers.teacherCollaborationInvitations, "yes");
});

// ---- signed management links ---------------------------------------------------------------------
const INTEREST = (keys = SHARED) => prefs(keys, "yes", { email: true, sms: false });
test("an email sign-up gets a signed link; a mobile-only sign-up does not", async () => {
  const withEmail = await saveInterestContact(db, { name: "Pat", email: "pat@example.invalid", reason: "", mobile: "", communicationPreferences: INTEREST() });
  const mobileOnly = await saveInterestContact(db, { name: "Rae", email: "", mobile: "+353871234570", reason: "", communicationPreferences: prefs(SHARED, "no") });
  assert.match(withEmail.manage!, /^\/preferences\/manage#[0-9a-f]{24}\.[0-9a-f]{64}$/);
  assert.equal(mobileOnly.manage, undefined);
  assert.deepEqual(idFromManageToken(withEmail.manage!.split("#")[1]), withEmail.id);
  assert.equal(await loadInterestPreferences(db, manageToken(mobileOnly.id)), null, "no link works for a mobile-only record");
});
test("a management link opens only its own record and rejects anything altered", async () => {
  const one = await saveInterestContact(db, { name: "One", email: "one@example.invalid", reason: "", mobile: "", communicationPreferences: INTEREST() });
  const two = await saveInterestContact(db, { name: "Two", email: "two@example.invalid", reason: "", mobile: "", communicationPreferences: INTEREST() });
  const token = manageToken(one.id), [id, digest] = token.split(".");
  for (const bad of [undefined, null, 42, "", "nope", `${id}.${"0".repeat(64)}`, `${id}.${digest.slice(0, 63)}`, `${two.id.toHexString()}.${digest}`, `${id.toUpperCase()}.${digest}`, `${token}.extra`, `${id}.${digest}\n`]) {
    assert.equal(idFromManageToken(bad), null, String(bad));
    assert.equal(await loadInterestPreferences(db, bad), null);
    await assert.rejects(saveInterestPreferences(db, bad, { communicationPreferences: prefs(SHARED, "no") }), /INVALID_LINK/);
  }
  const loaded = (await loadInterestPreferences(db, token))!;
  assert.deepEqual([loaded.audience, loaded.stored!.answers, loaded.hasMobile], ["interest", prefs(SHARED, "yes").answers, false]);
  const secret = process.env.ACCOUNT_EMAIL_SECRET; process.env.ACCOUNT_EMAIL_SECRET = "a-different-email-key-with-32-bytes!!";
  assert.equal(idFromManageToken(token), null, "a link signed with another secret is rejected");
  process.env.ACCOUNT_EMAIL_SECRET = secret;
});
test("a management link updates or withdraws the choices without an account", async () => {
  const one = await saveInterestContact(db, { name: "Link", email: "link@example.invalid", reason: "", mobile: "", communicationPreferences: INTEREST() });
  const other = await saveInterestContact(db, { name: "Bystander", email: "by@example.invalid", reason: "", mobile: "", communicationPreferences: INTEREST() });
  const token = manageToken(one.id), usersBefore = await db.collection("users").countDocuments();
  const changed = await saveInterestPreferences(db, token, { communicationPreferences: { answers: { ...prefs(SHARED, "no").answers, newsAndOffers: "yes" }, channels: { email: true, sms: false } } }, new Date("2026-11-19T10:00:00Z"));
  assert.equal(changed.source, "preferences-link");
  assert.equal(isOptedIn(changed, "newsAndOffers", "email"), true); assert.equal(isOptedIn(changed, "puckleUpdates", "email"), false);
  await assert.rejects(saveInterestPreferences(db, token, { communicationPreferences: { answers: prefs(SHARED, "yes").answers, channels: { email: false, sms: true } } }), /SMS_CHANNEL_NEEDS_MOBILE/);
  const withdrawn = await saveInterestPreferences(db, token, { communicationPreferences: prefs(SHARED, "no") });
  assert.deepEqual(withdrawn.channels, { email: false, sms: false });
  for (const key of SHARED) assert.equal(isOptedIn(withdrawn, key as "puckleUpdates", "email"), false);
  const stored = (await db.collection("puckleInterestContacts").findOne({ _id: one.id }))!;
  assert.equal(stored.communicationPreferences.answers.newsAndOffers, "no");
  assert.equal((await db.collection("puckleInterestContacts").findOne({ _id: other.id }))!.communicationPreferences.answers.puckleUpdates, "yes", "someone else is untouched");
  assert.equal(await db.collection("users").countDocuments(), usersBefore, "no account is created");
  await assert.rejects(saveInterestPreferences(db, token, { communicationPreferences: prefs(SHARED, "no"), email: "evil@example.invalid" }), /PREFERENCES_INVALID/);
  await saveInterestPreferences(db, token, { communicationPreferences: { answers: { ...prefs(SHARED, "no").answers, puckleUpdates: "yes" }, channels: { email: false, sms: true } }, mobile: "+353871234599", phoneCountryCode: "IE" });
  assert.equal((await db.collection("puckleInterestContacts").findOne({ _id: one.id }))!.mobile, "+353871234599", "a mobile can be added for Text");
});

test("records saved under the earlier wording keep their version until their owner saves again", async () => {
  const id = await member("student", { communicationPreferences: { answers: { ...prefs(ALL_STUDENT, "no").answers, puckleUpdates: "yes" }, channels: { email: true, sms: false }, source: "join-form", wordingVersion: "puckle-communication-preferences-v1", recordedAt: new Date("2026-11-01T00:00:00Z") } });
  assert.equal((await loadMemberPreferences(db, id))!.stored!.wordingVersion, "puckle-communication-preferences-v1");
  assert.equal((await membershipOf(id))!.communicationPreferences.wordingVersion, "puckle-communication-preferences-v1", "loading never rewrites it");
  const saved = await saveMemberPreferences(db, id, { communicationPreferences: prefs(ALL_STUDENT, "no") });
  assert.equal(saved.wordingVersion, "puckle-communication-preferences-v2");
});

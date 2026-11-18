import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { MongoClient, type Db } from "mongodb";
import { getMongoClient } from "../src/lib/mongodb";
import { saveInterestContact, saveNoEmailJoinContact } from "../src/lib/puckleJoinContacts";
import { idFromManageToken, loadInterestPreferences, saveInterestPreferences } from "../src/lib/puckleCommunicationPreferences";
import type { EmailMessage } from "../src/lib/siteEmail";

let server: MongoMemoryReplSet, client: MongoClient, db: Db;
const ORIGIN = "http://127.0.0.1:3999";
before(async () => {
  server = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  Object.assign(process.env, { MONGODB_URI: server.getUri(), MONGODB_DB: "switchplay_test_puckle_confirmation", SWITCHPLAY_DATABASE_MODE: "disposable",
    SESSION_SECRET: "test-session-secret", ACCOUNT_EMAIL_SECRET: "test-email-key-with-at-least-32-bytes", PUCKLE_FOUNDER_EMAIL: "founder@example.invalid",
    ACCOUNT_EMAIL_PUCKLE_ORIGIN: ORIGIN, ACCOUNT_EMAIL_PUCKLE_FROM: "Puckle fixture <x@example.invalid>" });
  client = await getMongoClient(); db = client.db(process.env.MONGODB_DB);
});
after(async () => { await client?.close(); await server?.stop(); });

const SHARED = ["puckleUpdates", "newsAndOffers", "occasionalPersonalContact"];
const answers = (value: "yes" | "no") => ({ answers: Object.fromEntries(SHARED.map(key => [key, value])), channels: value === "yes" ? { email: true, sms: false } : { email: false, sms: false } });
let sequence = 0;
const address = () => `confirm-${++sequence}-${Date.now()}@example.invalid`;
function outbox() {
  const sent: EmailMessage[] = [];
  return { sent, send: async (message: EmailMessage) => { sent.push(message); return { status: "sent" as const, attemptedAt: new Date(), reference: "fixture" }; } };
}
const signUp = (email: string, preferences = answers("no"), extra: Record<string, unknown> = {}) =>
  ({ name: "Pat Private", email, mobile: "", reason: "A secret reason", message: "", communicationPreferences: preferences, ...extra });
const confirmations = (sent: EmailMessage[]) => sent.filter(message => message.subject === "Your Puckle registration");
const row = (id: unknown) => db.collection("puckleInterestContacts").findOne({ _id: id as never });

test("an email sign-up gets the approved administrative email, even when every choice is No", async () => {
  const email = address(), box = outbox();
  const saved = await saveInterestContact(db, signUp(email, answers("no")), new Date(), { requester: `r-${email}`, send: box.send });
  await saved.notify();
  const [mail] = confirmations(box.sent);
  assert.equal(confirmations(box.sent).length, 1);
  assert.equal(mail.to, email);
  assert.equal(mail.subject, "Your Puckle registration");
  const link = `${ORIGIN}${saved.manage}`;
  assert.equal(mail.text, ["Thank you for registering your interest in Puckle.",
    "You can review or change your communication preferences, or unsubscribe, at any time using the link below:",
    `Manage your preferences: ${link}`, "If you did not submit this form, you can ignore this email.", "Puckle"].join("\n\n"));
  assert.match(mail.html!, new RegExp(`<a href="${link.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}">Manage your preferences</a>`));
  // Strictly administrative: nothing personal, nothing about their choices.
  for (const part of [mail.text, mail.html!]) assert.doesNotMatch(part, /Pat|Private|secret reason|updates|news|offers/i);
  assert.equal(box.sent.length, 2, "one founder alert and one confirmation");
  assert.deepEqual([(await row(saved.id))!.confirmationEmail.status, JSON.stringify((await row(saved.id))!.confirmationEmail).includes("preferences/manage")], ["sent", false], "the outcome never stores the link");
});
test("the emailed link is the existing signed management link for this record", async () => {
  const email = address(), box = outbox();
  const saved = await saveInterestContact(db, signUp(email), new Date(), { requester: `r-${email}`, send: box.send });
  await saved.notify();
  const url = new URL(confirmations(box.sent)[0].text.match(/https?:\/\/\S+/)![0]);
  assert.equal(url.origin, ORIGIN); assert.equal(url.pathname, "/preferences/manage");
  assert.equal(url.hash, saved.manage!.slice(saved.manage!.indexOf("#")));
  assert.equal(idFromManageToken(url.hash.slice(1))!.toHexString(), saved.id.toHexString());
  assert.equal(url.search, "", "the token is in the fragment, never a query string");
});
test("mobile-only sign-ups get no confirmation email", async () => {
  const box = outbox();
  const saved = await saveInterestContact(db, signUp("", answers("no"), { mobile: "+353871234599", phoneCountryCode: "IE" }), new Date(), { requester: "r-mobile", send: box.send });
  await saved.notify();
  assert.equal(confirmations(box.sent).length, 0);
  assert.equal(box.sent.length, 1, "only the founder alert");
  assert.equal((await row(saved.id))!.confirmationEmail, undefined);
});
test("the confirmation is rate limited per address and per requester without affecting the sign-up", async () => {
  const email = address(), box = outbox(), requester = `r-${email}`;
  const first = await saveInterestContact(db, signUp(email), new Date(), { requester, send: box.send });
  const second = await saveInterestContact(db, signUp(email), new Date(), { requester, send: box.send });
  await first.notify(); await second.notify();
  assert.equal(confirmations(box.sent).length, 1, "a second request for the same address inside the cooldown is not mailed");
  assert.equal((await row(second.id))!.confirmationEmail.status, "rate-limited");
  assert.ok(await row(second.id), "the sign-up itself was kept");
  const crowd = outbox(), spammer = `spammer-${Date.now()}`;
  for (let index = 0; index < 12; index += 1) await (await saveInterestContact(db, signUp(address()), new Date(), { requester: spammer, send: crowd.send })).notify();
  assert.equal(confirmations(crowd.sent).length, 10, "one requester cannot trigger more than the shared hourly budget");
});
test("delivery failures are recorded quietly and never break the sign-up or the founder alert", async () => {
  const failing = { sent: [] as EmailMessage[], send: async (message: EmailMessage) => { failing.sent.push(message); if (message.subject === "Your Puckle registration") throw new Error("provider down"); return { status: "sent" as const, attemptedAt: new Date(), reference: "fixture" }; } };
  const email = address();
  const saved = await saveInterestContact(db, signUp(email), new Date(), { requester: `r-${email}`, send: failing.send });
  await assert.doesNotReject(saved.notify());
  assert.equal((await row(saved.id))!.confirmationEmail.status, "unknown");
  assert.equal((await row(saved.id))!.founderNotification.status, "sent", "the founder alert is independent");
  const refused = { send: async () => ({ status: "failed" as const, attemptedAt: new Date(), reference: "provider-http-500" }) };
  const other = address();
  const second = await saveInterestContact(db, signUp(other), new Date(), { requester: `r-${other}`, send: refused.send });
  await second.notify();
  assert.deepEqual([(await row(second.id))!.confirmationEmail.status, (await row(second.id))!.confirmationEmail.reference], ["failed", "provider-http-500"]);
});
test("the same link keeps working after changing choices and after unsubscribing from everything", async () => {
  const email = address(), box = outbox();
  const saved = await saveInterestContact(db, signUp(email, answers("yes")), new Date(), { requester: `r-${email}`, send: box.send });
  await saved.notify();
  const token = new URL(confirmations(box.sent)[0].text.match(/https?:\/\/\S+/)![0]).hash.slice(1);
  assert.equal((await loadInterestPreferences(db, token))!.stored!.answers.puckleUpdates, "yes");
  await saveInterestPreferences(db, token, { communicationPreferences: { answers: { puckleUpdates: "yes", newsAndOffers: "no", occasionalPersonalContact: "no" }, channels: { email: true, sms: false } } });
  assert.equal((await loadInterestPreferences(db, token))!.stored!.answers.newsAndOffers, "no");
  await saveInterestPreferences(db, token, { communicationPreferences: answers("no") });
  const after = await loadInterestPreferences(db, token);
  assert.deepEqual([after!.stored!.answers.puckleUpdates, after!.stored!.channels], ["no", { email: false, sms: false }]);
  await saveInterestPreferences(db, token, { communicationPreferences: answers("yes") });
  assert.equal((await loadInterestPreferences(db, token))!.stored!.answers.puckleUpdates, "yes", "it can be used again to opt back in");
});
test("mobile-only requests with no email address still send only the founder alert", async () => {
  const saved = await saveNoEmailJoinContact(db, { registrationCategory: "teacher", name: "Tex", email: "", mobile: "+353871234572", phoneCountryCode: "IE", teacherIntroduction: "",
    communicationPreferences: { answers: { ...answers("no").answers, teacherCollaborationInvitations: "no" }, channels: { email: false, sms: false } } });
  await saved.notify();
  assert.equal(await db.collection("puckleJoinContactRequests").countDocuments({ confirmationEmail: { $exists: true } }), 0);
});

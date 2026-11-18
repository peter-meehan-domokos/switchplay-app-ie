import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { MongoClient, ObjectId, type Db } from "mongodb";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import { preparePuckleMembership } from "../scripts/prepare-puckle-membership";
import { requestEmailChallenge, verifyEmailChallenge, consumeEmailProof } from "../src/lib/accountEmailChallenges";
import { completePasswordReset, requestPasswordReset, passwordResetDetails } from "../src/lib/passwordRecovery";
import { prepareAccountCredentials, insertAccount, preparePasswordSession, authenticateUser, readSessionToken, accountConflict } from "../src/lib/auth";
import { withMongoTransaction, getMongoClient } from "../src/lib/mongodb";
import { randomEmailToken, tokenDigest } from "../src/lib/emailActionTokens";
import type { EmailMessage } from "../src/lib/siteEmail";
let server: MongoMemoryReplSet, client: MongoClient, db: Db;
const now = new Date(), later = (ms: number) => new Date(now.getTime() + ms);
const messages: EmailMessage[] = [];
const mail = { name: "Fixture", origin: "https://fixture.invalid", send: async (message: EmailMessage) => { messages.push(message); return { status: "sent" as const, attemptedAt: now, reference: "fixture" }; } };
let sequence = 0;
const address = () => `test-${++sequence}@example.invalid`;
const code = () => messages.at(-1)!.text.match(/\b\d{6}\b/)![0];
const resetToken = () => messages.at(-1)!.text.match(/#([\w-]{43})/)![1];
before(async () => {
  server = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = server.getUri(); process.env.MONGODB_DB = "switchplay_test_account_security";
  process.env.SWITCHPLAY_DATABASE_MODE = "disposable"; process.env.SESSION_SECRET = "test-session-secret"; process.env.ACCOUNT_EMAIL_SECRET = "test-email-key-with-at-least-32-bytes";
  client = await getMongoClient(); db = client.db(process.env.MONGODB_DB); await preparePuckleMembership(db);
});
after(async () => { await client?.close(); await server?.stop(); });
async function challenge() { const email = address(); const binding = await requestEmailChallenge(db, { email, requester: email }, mail, now); return { email, ...binding, code: code() }; }
async function legacy() { const email = address(), _id = new ObjectId(); await db.collection("users").insertOne({ _id, email, username: `Case${sequence}`, passwordHash: await bcrypt.hash("old", 4), cardsData: [{ preserved: true }], decksData: [{ preserved: true }], createdAt: now, updatedAt: now }); return (await db.collection("users").findOne({ _id }))!; }
test("verification stores no credentials/profile and proof is email/flow-bound", async () => {
  const input = await challenge(), result = await verifyEmailChallenge(db, input, now);
  const row = await db.collection("accountEmailChallenges").findOne({ challengeId: input.challengeId });
  assert.equal(row!.attempts, 0); assert.ok(!JSON.stringify(row).includes(input.code)); assert.ok(!JSON.stringify(row).includes(result.proof));
  assert.equal(await db.collection("users").countDocuments(), 0); assert.equal(await db.collection("puckleMemberships").countDocuments(), 0);
  await assert.rejects(withMongoTransaction(client, session => consumeEmailProof(db, session, { ...input, ...result, email: address() }, now)), /PROOF/);
  await assert.rejects(withMongoTransaction(client, session => consumeEmailProof(db, session, { ...input, ...result, flowToken: randomEmailToken() }, now)), /PROOF/);
});
test("five concurrent incorrect attempts stop further verification", async () => {
  const input = await challenge();
  await Promise.allSettled(Array.from({ length: 12 }, () => verifyEmailChallenge(db, { ...input, code: input.code === "000000" ? "000001" : "000000" }, now)));
  assert.equal((await db.collection("accountEmailChallenges").findOne({ challengeId: input.challengeId }))!.attempts, 5);
  await assert.rejects(verifyEmailChallenge(db, input, now), /PROOF/);
});
test("expiry, resend cooldown and replacement invalidate old codes/proofs", async () => {
  const input = await challenge();
  await assert.rejects(requestEmailChallenge(db, { email: input.email, binding: input, requester: input.email }, mail, later(59_000)), /RATE/);
  // First denied request still counts towards the hourly limit, conservatively.
  await requestEmailChallenge(db, { email: input.email, binding: input, requester: input.email }, mail, later(61_000)); const replacement = code();
  if (replacement !== input.code) await assert.rejects(verifyEmailChallenge(db, input, later(62_000)), /PROOF/);
  await assert.rejects(verifyEmailChallenge(db, { ...input, code: replacement }, later(662_000)), /PROOF/);
});
test("changing email replaces the bound challenge and requires the new code", async () => {
  const input = await challenge(), email = address();
  await requestEmailChallenge(db, { email, binding: input, requester: email }, mail, later(61_000));
  await assert.rejects(verifyEmailChallenge(db, input, later(62_000)), /PROOF/);
  assert.ok((await verifyEmailChallenge(db, { ...input, email, code: code() }, later(62_000))).proof);
});
test("concurrent correct verification issues only one proof", async () => {
  const input = await challenge();
  const results = await Promise.allSettled([verifyEmailChallenge(db, input, now), verifyEmailChallenge(db, input, now)]);
  assert.equal(results.filter(x => x.status === "fulfilled").length, 1);
});
test("existing email returns identical handle shape but only owner sign-in guidance", async () => {
  const user = await legacy(), result = await requestEmailChallenge(db, { email: user.email, requester: user.email }, mail, now);
  assert.deepEqual(Object.keys(result).sort(), ["challengeId", "flowToken"]); assert.match(messages.at(-1)!.text, /already uses/);
  await assert.rejects(verifyEmailChallenge(db, { ...result, email: user.email, code: "123456" }, now), /PROOF/);
});
test("provider failure is recorded without an account; throwing transports are sanitised", async () => {
  const email = address();
  await assert.rejects(requestEmailChallenge(db, { email, requester: email }, { ...mail, send: async () => { throw new Error("secret-provider-payload"); } }, now), /DELIVERY_UNCONFIRMED/);
  assert.equal((await db.collection("accountEmailChallenges").findOne({ email }))!.delivery.status, "unknown");
  assert.equal(await db.collection("users").findOne({ email }), null);
});
test("signing failure occurs before insertion or proof consumption", async () => {
  const input = await challenge(), proof = await verifyEmailChallenge(db, input, now), count = await db.collection("users").countDocuments();
  const secret = process.env.SESSION_SECRET; delete process.env.SESSION_SECRET;
  try { await assert.rejects(prepareAccountCredentials({ username: "Prepared", email: input.email, password: "new-password-12" }), /SECRET/); }
  finally { process.env.SESSION_SECRET = secret; }
  assert.equal(await db.collection("users").countDocuments(), count);
  assert.ok(proof.proof); assert.equal((await db.collection("accountEmailChallenges").findOne({ challengeId: input.challengeId }))!.usedAt, undefined);
});
test("account, profile and proof roll back together; duplicate username permits retry", async () => {
  const original = await legacy(), input = await challenge(), proof = await verifyEmailChallenge(db, input, now);
  const prepared = await prepareAccountCredentials({ username: original.username, email: input.email, password: "new-password-12" });
  const create = (candidate: typeof prepared, fail = false) => withMongoTransaction(client, async session => {
    const verifiedAt = await consumeEmailProof(db, session, { ...input, ...proof }, now);
    await insertAccount(db, session, candidate, verifiedAt);
    await db.collection("puckleMemberships").insertOne({ userId: candidate.document._id, registrationCategory: "teacher" }, { session });
    if (fail) throw new Error("profile-failure");
  });
  await assert.rejects(create(prepared), error => accountConflict(error) === "username");
  const corrected = await prepareAccountCredentials({ username: `New${sequence}`, email: input.email, password: "new-password-12" });
  await assert.rejects(create(corrected, true), /profile-failure/);
  assert.equal(await db.collection("users").findOne({ _id: corrected.document._id }), null);
  await create(corrected);
  const saved = await db.collection("users").findOne({ _id: corrected.document._id });
  assert.deepEqual(saved!.cardsData, []); assert.deepEqual(saved!.decksData, []); assert.deepEqual(saved!.sharedDeckData, []);
  assert.deepEqual(saved!.permissions, { publicPublishing: false }); assert.equal(saved!.sessionVersion, 0);
  await assert.rejects(create(corrected), /PROOF/);
});
test("legacy login uses email or exact-case username, with core DTO only", async () => {
  const user = await legacy();
  for (const identifier of [` ${user.email.toUpperCase()} `, user.username]) {
    const authenticated = await authenticateUser(identifier, "old");
    assert.equal(authenticated!.id, user._id.toHexString());
    assert.deepEqual(Object.keys(authenticated!).sort(), ["createdAt", "email", "id", "isAdmin", "updatedAt", "username"]);
  }
  assert.equal(await authenticateUser(user.username.toLowerCase(), "old"), null);
});
test("legacy JWTs are version zero; password reset preserves account and learning fields", async () => {
  const user = await legacy();
  const old = await new SignJWT({ email: user.email, username: user.username }).setProtectedHeader({ alg: "HS256" }).setSubject(user._id.toHexString()).setExpirationTime("1h").sign(new TextEncoder().encode(process.env.SESSION_SECRET));
  assert.equal((await readSessionToken(old))!.sessionVersion, 0);
  await requestPasswordReset(db, user.email, user.email, mail, now); const token = resetToken();
  await completePasswordReset(db, client, token, "a new password", () => now);
  const saved = await db.collection("users").findOne({ _id: user._id });
  const { passwordHash, passwordChangedAt, sessionVersion, ...preserved } = saved!;
  const { passwordHash: oldHash, ...expected } = user;
  assert.deepEqual(preserved, expected); assert.notEqual(passwordHash, oldHash); assert.ok(passwordChangedAt); assert.equal(sessionVersion, 1);
  assert.equal(await authenticateUser(user.email, "old"), null); assert.ok(await authenticateUser(user.email, "a new password"));
  await assert.rejects(completePasswordReset(db, client, token, "another password", () => now), /PROOF/);
});
test("reset rejects expired and wrong-purpose tokens, preserves invalid password proof", async () => {
  const user = await legacy(); await requestPasswordReset(db, user.email, user.email, mail, now); const token = resetToken();
  await assert.rejects(passwordResetDetails(db, token, later(1_800_000)), /PROOF/);
  await assert.rejects(completePasswordReset(db, client, token, "short", () => now), /PASSWORD/);
  assert.equal((await passwordResetDetails(db, token, now)).purpose, "password-reset");
  await db.collection("accountEmailActions").updateOne({ tokenDigest: tokenDigest(token) }, { $set: { purpose: "parent-request" } });
  await assert.rejects(passwordResetDetails(db, token, now), /PROOF/);
});
test("competing resets permit one change and invalidate all other outstanding links", async () => {
  const user = await legacy(); await requestPasswordReset(db, user.email, user.email, mail, now); const first = resetToken();
  await requestPasswordReset(db, user.email, user.email, mail, later(61_000)); const second = resetToken();
  const results = await Promise.allSettled([completePasswordReset(db, client, first, "first-password", () => later(62_000)), completePasswordReset(db, client, second, "second-password", () => later(62_000))]);
  assert.equal(results.filter(x => x.status === "fulfilled").length, 1);
  assert.equal((await db.collection("users").findOne({ _id: user._id }))!.sessionVersion, 1);
});
test("login racing reset signs the version of the verified password, never the new version", async () => {
  const user = await legacy(); await requestPasswordReset(db, user.email, user.email, mail, now); const token = resetToken();
  const original = bcrypt.compare; let reached!: () => void, resume!: () => void;
  const checked = new Promise<void>(r => { reached = r; }), gate = new Promise<void>(r => { resume = r; });
  bcrypt.compare = (async (password: string, hash: string) => { const valid = await original(password, hash); reached(); await gate; return valid; }) as typeof bcrypt.compare;
  try {
    const login = preparePasswordSession(user.email, "old"); await checked;
    await completePasswordReset(db, client, token, "changed-password", () => now); resume();
    const session = await readSessionToken((await login)!.sessionToken);
    assert.equal(session!.sessionVersion, 0); assert.equal((await db.collection("users").findOne({ _id: user._id }))!.sessionVersion, 1);
  } finally { resume(); bcrypt.compare = original; }
});
test("duplicate email transaction rolls back rather than authenticating the owner", async () => {
  const user = await legacy();
  const prepared = await prepareAccountCredentials({ username: `Collision${sequence}`, email: user.email, password: "collision-password" });
  await assert.rejects(withMongoTransaction(client, session => insertAccount(db, session, prepared, now)), error => accountConflict(error) === "email");
  assert.deepEqual(await db.collection("users").findOne({ _id: user._id }), user);
});
test("reset provider failure and absent email produce the same neutral outcome", async () => {
  const user = await legacy(); const failureMail = { ...mail, send: async () => { throw new Error("do-not-log"); } };
  assert.equal(await requestPasswordReset(db, user.email, user.email, failureMail, now), undefined);
  const absent = address(); assert.equal(await requestPasswordReset(db, absent, absent, failureMail, now), undefined);
  assert.equal((await db.collection("accountEmailActions").findOne({ userId: user._id }))!.delivery.status, "unknown");
});
test("recipient budgets and cooldown are shared between verification and recovery", async () => {
  const input = await challenge();
  await assert.rejects(requestPasswordReset(db, input.email, "different-requester", mail, later(30_000)), /RATE/);
  await requestPasswordReset(db, input.email, "different-requester", mail, later(61_000));
  await assert.rejects(requestEmailChallenge(db, { email: input.email, requester: "another-requester" }, mail, later(122_000)), /RATE/);
});
test("concurrent account transactions consume a verified proof at most once", async () => {
  const input = await challenge(), proof = await verifyEmailChallenge(db, input, now);
  const attempts = await Promise.allSettled([1, 2].map(() => withMongoTransaction(client, session => consumeEmailProof(db, session, { ...input, ...proof }, now))));
  assert.equal(attempts.filter(x => x.status === "fulfilled").length, 1);
});

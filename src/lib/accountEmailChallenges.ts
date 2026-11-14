import { randomInt } from "node:crypto";
import type { ClientSession, Db } from "mongodb";
import type { AccountEmailChallenge } from "./puckleMemberships";
import { normaliseAccountEmail } from "./accountCredentials";
import { protectedDigest, randomEmailToken, requireEmailToken, tokenDigest } from "./emailActionTokens";
import { limitEmailRequest } from "./emailRequestLimits";
import { existingAccountEmail, verificationEmail } from "./accountEmailTemplates";
import { deliverEmail, type EmailSender } from "./siteEmail";
type Challenge = AccountEmailChallenge & { verifiedAt?: Date; proofDigest?: string };
export type ChallengeBinding = { challengeId: string; flowToken: string };
const collection = (db: Db) => db.collection<Challenge>("accountEmailChallenges");
export async function requestEmailChallenge(db: Db, input: { email: unknown; binding?: ChallengeBinding; requester: string }, mail: { send: EmailSender; name: string; origin: string }, now = new Date()) {
  const email = normaliseAccountEmail(input.email);
  const binding = input.binding ?? { challengeId: randomEmailToken(), flowToken: randomEmailToken() };
  requireEmailToken(binding.challengeId); requireEmailToken(binding.flowToken);
  const flowBindingDigest = tokenDigest(binding.flowToken);
  const previous = input.binding ? await collection(db).findOne({ challengeId: binding.challengeId, flowBindingDigest }) : null;
  if (input.binding && !previous) throw new Error("INVALID_EMAIL_PROOF");
  await limitEmailRequest(db, email, input.requester, now);
  // Also limit a flow changing recipient; code requests cannot bypass resend cooldown.
  if (previous && previous.expiresAt.getTime() - 600_000 + 60_000 > now.getTime()) throw new Error("EMAIL_RATE_LIMITED");
  const exists = await db.collection("users").findOne({ email }, { projection: { _id: 1 } });
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const generation = (previous?.generation ?? 0) + 1;
  const record: Challenge = { challengeId: binding.challengeId, flowBindingDigest, email,
    codeDigest: protectedDigest("code", binding.challengeId, String(generation), exists ? randomEmailToken() : code),
    expiresAt: new Date(now.getTime() + 600_000), cleanupAt: new Date(now.getTime() + 600_000),
    attempts: 0, generation, delivery: { status: "pending" },
  };
  if (previous) {
    const result = await collection(db).replaceOne({ _id: previous._id, generation: previous.generation, usedAt: { $exists: false } }, record);
    if (!result.matchedCount) throw new Error("INVALID_EMAIL_PROOF");
  } else await collection(db).insertOne(record);
  const delivery = await deliverEmail(mail.send, { to: email, ...(exists ? existingAccountEmail(mail.name, mail.origin) : verificationEmail(mail.name, code)) });
  await collection(db).updateOne({ challengeId: binding.challengeId, generation }, { $set: { delivery } });
  if (delivery.status !== "sent") throw new Error("EMAIL_DELIVERY_UNCONFIRMED");
  return binding;
}
export async function verifyEmailChallenge(db: Db, input: ChallengeBinding & { email: unknown; code: unknown }, now = new Date()) {
  const email = normaliseAccountEmail(input.email);
  requireEmailToken(input.challengeId); requireEmailToken(input.flowToken);
  if (typeof input.code !== "string" || !/^\d{6}$/.test(input.code)) throw new Error("INVALID_EMAIL_PROOF");
  const filter = { challengeId: input.challengeId, flowBindingDigest: tokenDigest(input.flowToken), email,
    expiresAt: { $gt: now }, attempts: { $lt: 5 }, usedAt: { $exists: false }, verifiedAt: { $exists: false } };
  const row = await collection(db).findOne(filter);
  if (!row) throw new Error("INVALID_EMAIL_PROOF");
  const digest = protectedDigest("code", row.challengeId, String(row.generation), input.code);
  const proof = randomEmailToken();
  const verified = await collection(db).updateOne({ ...filter, generation: row.generation, codeDigest: digest }, { $set: { verifiedAt: now, proofDigest: tokenDigest(proof) } });
  if (!verified.matchedCount) {
    await collection(db).updateOne({ ...filter, generation: row.generation, codeDigest: { $ne: digest } }, { $inc: { attempts: 1 } });
    throw new Error("INVALID_EMAIL_PROOF");
  }
  return { proof, expiresAt: row.expiresAt };
}
/** Only the future account/profile transaction may consume a proof. Rollback leaves it reusable. */
export async function consumeEmailProof(db: Db, session: ClientSession, input: ChallengeBinding & { email: unknown; proof: string }, now = new Date()) {
  if (!session.inTransaction()) throw new Error("ACCOUNT_TRANSACTION_REQUIRED");
  requireEmailToken(input.proof); requireEmailToken(input.challengeId); requireEmailToken(input.flowToken);
  const row = await collection(db).findOneAndUpdate({ challengeId: input.challengeId, flowBindingDigest: tokenDigest(input.flowToken),
    email: normaliseAccountEmail(input.email), proofDigest: tokenDigest(input.proof), verifiedAt: { $exists: true },
    usedAt: { $exists: false }, expiresAt: { $gt: now } }, { $set: { usedAt: now } }, { session, returnDocument: "before" });
  if (!row?.verifiedAt) throw new Error("INVALID_EMAIL_PROOF");
  return row.verifiedAt;
}
/** Read-only pre-check so an invalid proof cannot cause password hashing work. Consumption stays transactional. */
export async function hasVerifiedEmailProof(db: Db, input: ChallengeBinding & { email: unknown; proof: unknown }, now = new Date()) {
  try {
    requireEmailToken(input.proof); requireEmailToken(input.challengeId); requireEmailToken(input.flowToken);
    return !!await collection(db).findOne({ challengeId: input.challengeId, flowBindingDigest: tokenDigest(input.flowToken),
      email: normaliseAccountEmail(input.email), proofDigest: tokenDigest(input.proof as string), verifiedAt: { $exists: true },
      usedAt: { $exists: false }, expiresAt: { $gt: now } }, { projection: { _id: 1 } });
  } catch { return false; }
}

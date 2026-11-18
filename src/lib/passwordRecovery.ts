import type { Db, MongoClient } from "mongodb";
import type { AccountEmailAction } from "./puckleMemberships";
import { normaliseAccountEmail } from "./accountCredentials";
import { hashNewPassword } from "./auth";
import { randomEmailToken, requireEmailToken, tokenDigest } from "./emailActionTokens";
import { limitEmailRequest } from "./emailRequestLimits";
import { passwordResetEmail } from "./accountEmailTemplates";
import { deliverEmail, type EmailSender } from "./siteEmail";
import { withMongoTransaction } from "./mongodb";
const actions = (db: Db) => db.collection<AccountEmailAction>("accountEmailActions");
export async function requestPasswordReset(db: Db, emailInput: unknown, requester: string, mail: { send: EmailSender; name: string; origin: string }, now = new Date()) {
  const email = normaliseAccountEmail(emailInput);
  await limitEmailRequest(db, email, requester, now);
  const user = await db.collection("users").findOne({ email }, { projection: { _id: 1, email: 1, sessionVersion: 1 } });
  if (!user) return;
  const token = randomEmailToken();
  const action: AccountEmailAction = { purpose: "password-reset", userId: user._id, tokenDigest: tokenDigest(token),
    generation: user.sessionVersion ?? 0, recipient: user.email, expiresAt: new Date(now.getTime() + 1_800_000),
    cleanupAt: new Date(now.getTime() + 1_800_000), delivery: { status: "pending" } };
  await actions(db).insertOne(action);
  const delivery = await deliverEmail(mail.send, { to: user.email, ...passwordResetEmail(mail.name, mail.origin, token) });
  await actions(db).updateOne({ tokenDigest: action.tokenDigest }, { $set: { delivery } });
  // Always neutral, including failed delivery; persisted outcome supports operator diagnosis.
}
async function validReset(db: Db, token: unknown, now: Date, session?: import("mongodb").ClientSession) {
  const digest = tokenDigest(requireEmailToken(token));
  const action = await actions(db).findOne({ tokenDigest: digest, purpose: "password-reset", usedAt: { $exists: false }, expiresAt: { $gt: now } }, { session });
  if (!action) throw new Error("INVALID_EMAIL_PROOF");
  const user = await db.collection("users").findOne({ _id: action.userId }, { session, projection: { sessionVersion: 1, email: 1 } });
  if (!user || (user.sessionVersion ?? 0) !== action.generation || user.email !== action.recipient) throw new Error("INVALID_EMAIL_PROOF");
  return action;
}
export async function passwordResetDetails(db: Db, token: unknown, now = new Date()) {
  await validReset(db, token, now);
  return { purpose: "password-reset" as const }; // No account/guardian directory or unnecessary PII.
}
export async function completePasswordReset(db: Db, client: MongoClient, token: unknown, password: unknown, clock: () => Date = () => new Date()) {
  await validReset(db, token, clock());
  const passwordHash = await hashNewPassword(password); // Outside retried callback.
  await withMongoTransaction(client, async session => {
    const now = clock(), action = await validReset(db, token, now, session);
    const result = await db.collection("users").updateOne({ _id: action.userId,
      ...(action.generation === 0 ? { $or: [{ sessionVersion: 0 }, { sessionVersion: { $exists: false } }] } : { sessionVersion: action.generation }),
    }, { $set: { passwordHash, passwordChangedAt: now }, $inc: { sessionVersion: 1 } }, { session });
    if (!result.matchedCount) throw new Error("INVALID_EMAIL_PROOF");
    // Every outstanding capability for this old credential generation is consumed.
    await actions(db).updateMany({ userId: action.userId, purpose: "password-reset", usedAt: { $exists: false } }, { $set: { usedAt: now } }, { session });
  });
}

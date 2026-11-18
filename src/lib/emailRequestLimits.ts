import type { Db } from "mongodb";
import type { EmailRequestLimit } from "./puckleMemberships";
import { protectedDigest } from "./emailActionTokens";
async function take(db: Db, key: string, maximum: number, seconds: number, now: Date) {
  const bucket = Math.floor(now.getTime() / (seconds * 1000));
  const _id = protectedDigest("limit", key, String(bucket));
  const row = await db.collection<EmailRequestLimit>("emailRequestLimits").findOneAndUpdate({ _id },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((bucket + 1) * seconds * 1000) } }, { upsert: true, returnDocument: "after" });
  if (!row || row.count > maximum) throw new Error("EMAIL_RATE_LIMITED");
}
export async function limitEmailRequest(db: Db, email: string, requester: string, now: Date) {
  // One shared recipient budget across registration, reset and future parental mail.
  await take(db, `requester:${requester}`, 10, 3600, now);
  await take(db, `recipient-hour:${email}`, 3, 3600, now);
  await take(db, `recipient-day:${email}`, 5, 86400, now);
  const _id = protectedDigest("cooldown", email);
  const row = await db.collection<EmailRequestLimit>("emailRequestLimits").findOneAndUpdate({ _id, expiresAt: { $lte: now } },
    { $set: { count: 1, expiresAt: new Date(now.getTime() + 60_000) } }, { returnDocument: "after" });
  if (row) return;
  try { await db.collection<EmailRequestLimit>("emailRequestLimits").insertOne({ _id, count: 1, expiresAt: new Date(now.getTime() + 60_000) }); }
  catch (error) { if ((error as { code?: number }).code === 11000) throw new Error("EMAIL_RATE_LIMITED"); throw error; }
}
/** Small requester-only window for contact forms that notify the founder; not an email-recipient budget. */
export async function limitRequesterAction(db: Db, scope: string, requester: string, maximum: number, seconds: number, now: Date) {
  await take(db, `${scope}:${requester}`, maximum, seconds, now);
}

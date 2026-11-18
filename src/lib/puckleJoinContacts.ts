import type { Db, ObjectId } from "mongodb";
import { ObjectId as Id } from "mongodb";
import { validateInterestContact, validateNoEmailContact } from "@/app/sites/puckle/lib/membershipRegistration";
import { founderInterestEmail, founderNoEmailRequestEmail } from "@/app/sites/puckle/lib/memberEmailTemplates";
import type { InterestContact, NoEmailJoinContact } from "./puckleMemberships";
import { notifyFounder } from "./founderNotifications";

/**
 * Contact-only records. Neither creates an account, profile, username reservation or credential,
 * and neither is ever converted automatically. Submitted DOB here is contact history only.
 * Persistence succeeds independently of the founder alert, which the caller schedules with after().
 */
export async function saveNoEmailJoinContact(db: Db, value: unknown, now = new Date()) {
  const record: NoEmailJoinContact = { ...validateNoEmailContact(value), createdAt: now, founderNotification: { status: "pending" } };
  const _id = new Id();
  await db.collection<NoEmailJoinContact & { _id: ObjectId }>("puckleJoinContactRequests").insertOne({ _id, ...record });
  return { id: _id, notify: () => notifyFounder(db, { collection: "puckleJoinContactRequests", id: _id }, founderNoEmailRequestEmail({
    id: _id.toHexString(), category: record.registrationCategory, name: record.name, mobile: record.mobile,
    education: record.education, introduction: record.teacherIntroduction, preferences: record.communicationPreferences })) };
}
export async function saveInterestContact(db: Db, value: unknown, now = new Date()) {
  const record: InterestContact = { ...validateInterestContact(value, now), createdAt: now, founderNotification: { status: "pending" } };
  const _id = new Id();
  await db.collection<InterestContact & { _id: ObjectId }>("puckleInterestContacts").insertOne({ _id, ...record });
  return { id: _id, notify: () => notifyFounder(db, { collection: "puckleInterestContacts", id: _id }, founderInterestEmail({
    id: _id.toHexString(), name: record.name, email: record.email, mobile: record.mobile, reason: record.reason,
    message: record.message, preferences: record.communicationPreferences })) };
}

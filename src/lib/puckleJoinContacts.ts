import type { Db, ObjectId } from "mongodb";
import { ObjectId as Id } from "mongodb";
import { validateInterestContact, validateNoEmailContact } from "@/app/sites/puckle/lib/membershipRegistration";
import { founderInterestEmail, founderNoEmailRequestEmail, interestConfirmationEmail } from "@/app/sites/puckle/lib/memberEmailTemplates";
import type { InterestContact, NoEmailJoinContact } from "./puckleMemberships";
import { notifyFounder } from "./founderNotifications";
import { limitEmailRequest } from "./emailRequestLimits";
import { deliverEmail, siteEmailConfig, siteEmailSender, type EmailSender } from "./siteEmail";
import { manageLink } from "./puckleCommunicationPreferences";

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
/**
 * Administrative confirmation for an email sign-up, run from after() once the record is committed. It carries only the
 * signed management link. It never throws and never affects the saved record beyond recording a sanitised outcome.
 * The recipient and requester budgets are the shared email limits, so nobody can use the form to mail an address repeatedly.
 */
async function sendInterestConfirmation(db: Db, target: { id: ObjectId; email: string }, requester: string, send?: EmailSender) {
  const record = async (outcome: { status: string; attemptedAt: Date; reference: string }) => {
    try { await db.collection("puckleInterestContacts").updateOne({ _id: target.id }, { $set: { confirmationEmail: outcome } }); } catch { /* the outcome is only a note */ }
  };
  const attemptedAt = new Date();
  try {
    try { await limitEmailRequest(db, target.email, requester, attemptedAt); }
    catch (error) {
      if (error instanceof Error && error.message === "EMAIL_RATE_LIMITED") return await record({ status: "rate-limited", attemptedAt, reference: "not-sent" });
      throw error;
    }
    const link = `${siteEmailConfig("puckle").origin}${manageLink(target.id)}`;
    await record(await deliverEmail(send ?? siteEmailSender("puckle"), { to: target.email, ...interestConfirmationEmail(link) }));
  } catch { await record({ status: "unknown", attemptedAt, reference: "confirmation-interrupted" }); }
}
export async function saveInterestContact(db: Db, value: unknown, now = new Date(), delivery: { requester?: string; send?: EmailSender } = {}) {
  const record: InterestContact = { ...validateInterestContact(value, now), createdAt: now, founderNotification: { status: "pending" } };
  const _id = new Id();
  await db.collection<InterestContact & { _id: ObjectId }>("puckleInterestContacts").insertOne({ _id, ...record });
  // An email sign-up gets a signed link to change or withdraw its choices. Without the email secret there is simply no link.
  const manage = record.email ? (() => { try { return manageLink(_id); } catch { return undefined; } })() : undefined;
  const alert = () => notifyFounder(db, { collection: "puckleInterestContacts", id: _id }, founderInterestEmail({
    id: _id.toHexString(), name: record.name, email: record.email, mobile: record.mobile, reason: record.reason,
    message: record.message, preferences: record.communicationPreferences }), delivery.send);
  // Both emails are independent: a failure of one cannot stop the other. Mobile-only sign-ups get no confirmation.
  return { id: _id, manage, notify: async () => {
    await alert();
    if (record.email) await sendInterestConfirmation(db, { id: _id, email: record.email }, delivery.requester ?? "unattributed", delivery.send);
  } };
}

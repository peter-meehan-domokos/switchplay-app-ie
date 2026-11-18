import type { Db, ObjectId } from "mongodb";
import { deliverEmail, siteEmailSender, type EmailMessage, type EmailSender } from "./siteEmail";

/**
 * Best-effort founder alert, run from after() once the source record is committed. It never throws,
 * never changes the saved submission and records only a sanitised outcome. Acceptance by the transport
 * is not proof of delivery; a callback that never runs leaves "pending" for manual recovery.
 */
export async function notifyFounder(
  db: Db,
  target: { collection: string; id: ObjectId },
  message: Omit<EmailMessage, "to">,
  send?: EmailSender,
  /** Where the outcome is recorded on the target document (default: a top-level founderNotification field). */
  field = "founderNotification",
) {
  const attemptedAt = new Date();
  try {
    const to = process.env.PUCKLE_FOUNDER_EMAIL?.trim();
    const outcome = !to || !/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(to)
      ? { status: "failed" as const, attemptedAt, reference: "founder-email-not-configured" }
      : await deliverEmail(send ?? siteEmailSender("puckle"), { ...message, to });
    await db.collection(target.collection).updateOne({ _id: target.id }, { $set: { [field]: outcome } });
  } catch {
    // Configuration or database problems must not surface to the person who submitted.
    try {
      await db.collection(target.collection).updateOne({ _id: target.id },
        { $set: { [field]: { status: "unknown", attemptedAt, reference: "notification-interrupted" } } });
    } catch { /* leave pending for manual recovery */ }
  }
}

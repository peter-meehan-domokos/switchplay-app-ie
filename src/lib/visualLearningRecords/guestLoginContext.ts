import type { Db } from "mongodb";
import { parseVisualGuestCredential, VISUAL_GUEST_CLAIMS_COLLECTION, VISUAL_GUEST_COLLECTION, type VisualGuest } from "./guestCredentials";
import type { VisualAttempt, VisualGuestClaim, VisualRecord } from "./model";

/** Public handles only. The credential remains in its HttpOnly cookie. */
export type VisualGuestLoginContext = Readonly<{
  guestLearner: string; activityId: string; foregroundAttemptId: string;
  claimId?: string; createdAt?: string;
}>;
export async function findVisualGuestLoginContext(db: Db, accountId: string, credential?: string, claimId?: string): Promise<VisualGuestLoginContext | undefined> {
  const claims = db.collection<VisualGuestClaim>(VISUAL_GUEST_CLAIMS_COLLECTION);
  let claim = claimId ? await claims.findOne({ claimId, accountId }) : null;
  if (!claim) {
    const parsed = parseVisualGuestCredential(credential); if (!parsed) return;
    const guest = await db.collection<VisualGuest>(VISUAL_GUEST_COLLECTION).findOne(parsed); if (!guest) return;
    if (guest.status === "active" && guest.expiresAt > new Date()) {
      // Existing records only: ordinary sign-in must never issue a guest or
      // fabricate an activity attempt merely to discover progress.
      const root = await db.collection<VisualRecord>("visualRecords").find({ principalKey: `guest:${guest.guestId}` }).sort({ updatedAt: -1 }).limit(1).next();
      if (root) return { guestLearner: `guest:${guest.guestId}`, activityId: root.activityId, foregroundAttemptId: root.activeAttemptId };
      return;
    }
    if (guest.claimedBy !== accountId || !guest.claimId) return;
    claim = await claims.findOne({ claimId: guest.claimId, accountId });
  }
  if (!claim) return;
  const attempt = await db.collection<VisualAttempt>("visualAttempts").findOne({ attemptId: claim.foregroundAttemptId });
  if (!attempt) return;
  return { guestLearner: `guest:${claim.guestId}`, activityId: attempt.activityId, foregroundAttemptId: claim.foregroundAttemptId,
    claimId: claim.claimId, createdAt: claim.createdAt.toISOString() };
}

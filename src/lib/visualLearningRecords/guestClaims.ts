import type { ClientSession } from "mongodb";
import { withMongoTransaction } from "../mongodb";
import { assertUuid, principalKey, requireVisual, safeCount } from "./contracts";
import { parseVisualGuestCredential, VISUAL_GUEST_CLAIMS_COLLECTION, VISUAL_GUEST_COLLECTION, type VisualGuest } from "./guestCredentials";
import type { LearnerPrincipal, VisualClaimMapping, VisualClaimReceipt, VisualClaimRequest, VisualGuestClaim } from "./model";
import type { VisualLearningRecordRepository } from "./repository";

export class VisualGuestClaims {
  constructor(readonly records: VisualLearningRecordRepository) {}
  private claims() { return this.records.db.collection<VisualGuestClaim>(VISUAL_GUEST_CLAIMS_COLLECTION); }
  private guests() { return this.records.db.collection<VisualGuest>(VISUAL_GUEST_COLLECTION); }
  private async transaction<T>(run: (session: ClientSession) => Promise<T>) {
    await this.records.assertIndexesReady(); return withMongoTransaction(this.records.client, run);
  }
  private async freeze(account: LearnerPrincipal, credential: string | undefined, request: VisualClaimRequest) {
    return this.transaction(async session => {
      const previous = await this.claims().findOne({ claimId: request.claimId }, { session });
      if (previous) {
        requireVisual(previous.accountId === account.id, "VISUAL_CLAIM_FORBIDDEN");
        requireVisual(previous.foregroundAttemptId === request.foregroundAttemptId, "VISUAL_CLAIM_ID_CONFLICT");
        // Once bound, only the authenticated target account may recover its own
        // durable receipt, even if a lost response already cleared its cookie.
        return previous;
      }
      const parsed = parseVisualGuestCredential(credential); requireVisual(parsed, "VISUAL_CLAIM_FORBIDDEN");
      const now = new Date(), guest = await this.guests().findOne({ ...parsed, status: "active", expiresAt: { $gt: now } }, { session });
      requireVisual(guest && !guest.claimId, "VISUAL_CLAIM_FORBIDDEN");
      const roots = await this.records.records().find({ principalKey: `guest:${guest.guestId}` }, { session }).toArray();
      const foreground = roots.find(root => root.activeAttemptId === request.foregroundAttemptId);
      requireVisual(foreground && !foreground.claimArchive, "VISUAL_CLAIM_FOREGROUND_CONFLICT");
      requireVisual(await this.records.attempts().findOne({ attemptId: request.foregroundAttemptId, recordId: foreground.recordId }, { session }), "VISUAL_CLAIM_FOREGROUND_CONFLICT");
      const claim: VisualGuestClaim = { claimId: request.claimId, accountId: account.id, guestId: guest.guestId,
        foregroundAttemptId: request.foregroundAttemptId, recordIds: [foreground.recordId, ...roots.filter(root => root !== foreground).map(root => root.recordId)], mappings: [], createdAt: now };
      const frozen = await this.guests().updateOne({ guestId: guest.guestId, status: "active", expiresAt: { $gt: now } },
        { $set: { status: "claiming", claimId: claim.claimId, claimedBy: account.id }, $inc: { useCount: 1 } }, { session });
      requireVisual(frozen.modifiedCount === 1, "VISUAL_CLAIM_CONFLICT");
      await this.claims().insertOne(claim, { session }); return claim;
    });
  }
  private async transfer(claimId: string, accountId: string, recordId: string) {
    return this.transaction(async session => {
      const claim = await this.claims().findOne({ claimId, accountId }, { session }); requireVisual(claim, "VISUAL_CLAIM_FORBIDDEN");
      const previous = claim.mappings.find(mapping => mapping.guestRecordId === recordId); if (previous) return previous;
      requireVisual(claim.recordIds.includes(recordId) && !claim.completedAt, "VISUAL_CLAIM_CONFLICT");
      const guest = await this.guests().updateOne({ guestId: claim.guestId, status: "claiming", claimId, claimedBy: accountId }, { $inc: { useCount: 1 } }, { session });
      requireVisual(guest.matchedCount === 1, "VISUAL_CLAIM_CONFLICT");
      const guestRoot = await this.records.records().findOne({ recordId, principalKey: `guest:${claim.guestId}` }, { session });
      requireVisual(guestRoot && !guestRoot.claimArchive, "VISUAL_STORAGE_INCONSISTENT");
      const count = await this.records.attempts().countDocuments({ recordId }, { session });
      requireVisual(count === guestRoot.attemptCount && count > 0, "VISUAL_STORAGE_INCONSISTENT");
      let accountRoot = await this.records.records().findOne({ principalKey: `account:${accountId}`, activityId: guestRoot.activityId }, { session });
      const now = new Date();
      if (!accountRoot) {
        await this.records.records().updateOne({ recordId, principalKey: guestRoot.principalKey },
          { $set: { principalKey: `account:${accountId}`, claimedFromGuestId: claim.guestId, updatedAt: now }, $inc: { revision: 1 } }, { session });
        accountRoot = { ...guestRoot, principalKey: `account:${accountId}`, claimedFromGuestId: claim.guestId };
      } else {
        const total = accountRoot.attemptCount + count; requireVisual(safeCount(total + 1), "VISUAL_ATTEMPT_LIMIT");
        const activeAttemptId = guestRoot.activeAttemptId === claim.foregroundAttemptId ? claim.foregroundAttemptId : accountRoot.activeAttemptId;
        const moved = await this.records.attempts().updateMany({ recordId }, { $set: { recordId: accountRoot.recordId } }, { session });
        requireVisual(moved.matchedCount === count, "VISUAL_STORAGE_INCONSISTENT");
        await this.records.records().updateOne({ recordId: accountRoot.recordId, principalKey: accountRoot.principalKey },
          { $set: { activeAttemptId, attemptCount: total, updatedAt: now }, $inc: { revision: 1 } }, { session });
        // Keep the old root as audit evidence. No API resolves it as an alias;
        // every moved attempt is owned directly by the account record.
        await this.records.records().updateOne({ recordId }, { $set: { claimArchive: { claimId, accountId, accountRecordId: accountRoot.recordId } }, $inc: { revision: 1 } }, { session });
        accountRoot = { ...accountRoot, activeAttemptId, attemptCount: total };
      }
      const mapping: VisualClaimMapping = { activityId: guestRoot.activityId, guestRecordId: recordId, recordId: accountRoot.recordId,
        guestActiveAttemptId: guestRoot.activeAttemptId, activeAttemptId: accountRoot.activeAttemptId, nextAttemptNumber: accountRoot.attemptCount + 1 };
      await this.claims().updateOne({ claimId, accountId }, { $push: { mappings: mapping } }, { session });
      return mapping;
    });
  }
  async claim(account: LearnerPrincipal, credential: string | undefined, request: VisualClaimRequest): Promise<VisualClaimReceipt> {
    requireVisual(account.kind === "account", "VISUAL_CLAIM_FORBIDDEN"); principalKey(account); assertUuid(request.claimId); assertUuid(request.foregroundAttemptId);
    const frozen = await this.freeze(account, credential, request);
    for (const recordId of frozen.recordIds) await this.transfer(frozen.claimId, account.id, recordId);
    return this.transaction(async session => {
      const claim = await this.claims().findOne({ claimId: request.claimId, accountId: account.id }, { session });
      requireVisual(claim && claim.mappings.length === claim.recordIds.length, "VISUAL_CLAIM_CONFLICT");
      if (!claim.completedAt) {
        const guest = await this.guests().updateOne({ guestId: claim.guestId, status: "claiming", claimId: claim.claimId, claimedBy: account.id }, { $set: { status: "claimed" } }, { session });
        requireVisual(guest.matchedCount === 1, "VISUAL_CLAIM_CONFLICT");
        await this.claims().updateOne({ claimId: claim.claimId, accountId: account.id }, { $set: { completedAt: new Date() } }, { session });
      }
      return { claimId: claim.claimId, learner: `account:${account.id}`, guestLearner: `guest:${claim.guestId}`,
        foregroundAttemptId: claim.foregroundAttemptId, mappings: claim.mappings };
    });
  }
}

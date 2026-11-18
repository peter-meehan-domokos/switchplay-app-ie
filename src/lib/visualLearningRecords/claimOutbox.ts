import { assertBoundedJson, assertUuid, exactFields, principalKey, recordObject, requireVisual, safeCount, safeId } from "./contracts";
import type { VisualClaimReceipt } from "./model";
import { hasPendingVisualWork, visualOutboxKey, type VisualOutbox } from "./outbox";

export type VisualClaimJournal = Readonly<{
  claimId: string; guestLearner: string; accountLearner?: string; activityId: string; foregroundAttemptId: string;
  createdAt: string; phase: "awaiting-login" | "prepared" | "installed"; receipt?: VisualClaimReceipt;
}>;
export function assertVisualClaimJournal(value: unknown): asserts value is VisualClaimJournal {
  assertBoundedJson(value);
  requireVisual(recordObject(value) && Object.keys(value).every(key => ["claimId", "guestLearner", "accountLearner", "activityId", "foregroundAttemptId", "createdAt", "phase", "receipt"].includes(key)), "INVALID_VISUAL_CLAIM_JOURNAL");
  assertUuid(value.claimId); assertUuid(value.foregroundAttemptId);
  requireVisual(typeof value.guestLearner === "string" && value.guestLearner.startsWith("guest:"), "INVALID_VISUAL_CLAIM_JOURNAL"); assertUuid(value.guestLearner.slice(6));
  requireVisual(safeId(value.activityId) && typeof value.createdAt === "string" && Number.isFinite(Date.parse(value.createdAt))
    && ["awaiting-login", "prepared", "installed"].includes(String(value.phase)), "INVALID_VISUAL_CLAIM_JOURNAL");
  if (value.accountLearner !== undefined) requireVisual(typeof value.accountLearner === "string" && value.accountLearner.startsWith("account:")
    && principalKey({ kind: "account", id: value.accountLearner.slice(8) }) === value.accountLearner, "INVALID_VISUAL_CLAIM_JOURNAL");
  requireVisual(value.phase === "awaiting-login" || value.accountLearner, "INVALID_VISUAL_CLAIM_JOURNAL");
  requireVisual(value.phase === "installed" ? value.receipt : value.receipt === undefined, "INVALID_VISUAL_CLAIM_JOURNAL");
  if (value.phase === "installed") assertVisualClaimReceipt(value.receipt, value as VisualClaimJournal);
}
export function assertVisualClaimReceipt(value: unknown, journal: VisualClaimJournal): asserts value is VisualClaimReceipt {
  assertBoundedJson(value);
  requireVisual(recordObject(value) && exactFields(value, ["claimId", "learner", "guestLearner", "foregroundAttemptId", "mappings"])
    && value.claimId === journal.claimId && value.learner === journal.accountLearner && value.guestLearner === journal.guestLearner
    && value.foregroundAttemptId === journal.foregroundAttemptId && Array.isArray(value.mappings) && value.mappings.length > 0, "INVALID_VISUAL_CLAIM_RECEIPT");
  const activities = new Set<string>(), records = new Set<string>(), guestRecords = new Set<string>();
  let foreground = false;
  for (const mapping of value.mappings) {
    requireVisual(recordObject(mapping) && exactFields(mapping, ["activityId", "guestRecordId", "recordId", "guestActiveAttemptId", "activeAttemptId", "nextAttemptNumber"])
      && safeId(mapping.activityId) && safeCount(mapping.nextAttemptNumber) && mapping.nextAttemptNumber > 1, "INVALID_VISUAL_CLAIM_RECEIPT");
    for (const field of ["guestRecordId", "recordId", "guestActiveAttemptId", "activeAttemptId"] as const) assertUuid(mapping[field]);
    const activityId = mapping.activityId, recordId = mapping.recordId as string, guestRecordId = mapping.guestRecordId as string;
    requireVisual(!activities.has(activityId) && !records.has(recordId) && !guestRecords.has(guestRecordId), "INVALID_VISUAL_CLAIM_RECEIPT");
    activities.add(activityId); records.add(recordId); guestRecords.add(guestRecordId);
    if (mapping.guestActiveAttemptId === journal.foregroundAttemptId) {
      requireVisual(mapping.activeAttemptId === journal.foregroundAttemptId && activityId === journal.activityId, "INVALID_VISUAL_CLAIM_RECEIPT"); foreground = true;
    }
  }
  requireVisual(foreground, "INVALID_VISUAL_CLAIM_RECEIPT");
}
export function sameVisualClaimReceipt(left: VisualClaimReceipt, right: VisualClaimReceipt) {
  if (left.claimId !== right.claimId || left.learner !== right.learner || left.guestLearner !== right.guestLearner
    || left.foregroundAttemptId !== right.foregroundAttemptId || left.mappings.length !== right.mappings.length) return false;
  const entries = new Map(right.mappings.map(mapping => [mapping.guestRecordId, mapping]));
  return left.mappings.every(mapping => {
    const other = entries.get(mapping.guestRecordId);
    return other && other.activityId === mapping.activityId && other.recordId === mapping.recordId && other.activeAttemptId === mapping.activeAttemptId
      && other.guestActiveAttemptId === mapping.guestActiveAttemptId && other.nextAttemptNumber === mapping.nextAttemptNumber;
  });
}

/** Pure plan for one IndexedDB transaction. Old actor rows are deleted only in
 * that same transaction as their account copies and the installed journal. */
export function planVisualClaimInstall(journal: VisualClaimJournal, receipt: VisualClaimReceipt, guestRows: readonly VisualOutbox[], accountRows: readonly VisualOutbox[]) {
  assertVisualClaimJournal(journal); assertVisualClaimReceipt(receipt, journal);
  requireVisual(journal.phase === "prepared", "VISUAL_CLAIM_LOCAL_CONFLICT");
  const puts = new Map<string, VisualOutbox>(), deletes = new Set<string>(), existing = new Map(accountRows.map(row => [row.key, row]));
  const mappingByGuest = new Map(receipt.mappings.map(mapping => [mapping.guestRecordId, mapping]));
  const archive = (row: VisualOutbox) => {
    const key = `${visualOutboxKey(receipt.learner, row.session.activityId)}|${row.session.attemptId}`, stored = existing.get(key) ?? puts.get(key);
    const next = { ...row, key };
    requireVisual(!stored || JSON.stringify(stored) === JSON.stringify(next), "VISUAL_CLAIM_LOCAL_CONFLICT"); puts.set(key, next);
  };
  for (const row of accountRows) {
    requireVisual(row.learner === receipt.learner && row.session.learner === receipt.learner, "VISUAL_SESSION_CONFLICT");
    const base = visualOutboxKey(receipt.learner, row.session.activityId);
    requireVisual(row.key === base || row.key === `${base}|${row.session.attemptId}`, "VISUAL_CLAIM_LOCAL_CONFLICT");
    const mapping = receipt.mappings.find(mapping => mapping.recordId === row.session.recordId && mapping.activityId === row.session.activityId);
    requireVisual(!mapping || !row.command, "VISUAL_CLAIM_PENDING_ACCOUNT_ATTEMPT");
    if (!mapping || row.key !== base) continue;
    if (mapping.activeAttemptId === journal.foregroundAttemptId && row.session.attemptId !== journal.foregroundAttemptId) {
      archive(row); deletes.add(base);
    } else puts.set(base, { ...row, session: { ...row.session, nextAttemptNumber: mapping.nextAttemptNumber } });
  }
  for (const row of guestRows) {
    requireVisual(row.learner === receipt.guestLearner && row.session.learner === receipt.guestLearner, "VISUAL_SESSION_CONFLICT");
    requireVisual(!hasPendingVisualWork(row) && !row.conflict, "VISUAL_CLAIM_PENDING_WORK");
    const mapping = mappingByGuest.get(row.session.recordId); requireVisual(mapping && mapping.activityId === row.session.activityId, "VISUAL_CLAIM_LOCAL_CONFLICT");
    requireVisual(mapping.nextAttemptNumber > row.session.attemptNumber, "VISUAL_CLAIM_LOCAL_CONFLICT");
    const oldBase = visualOutboxKey(receipt.guestLearner, row.session.activityId), base = visualOutboxKey(receipt.learner, row.session.activityId);
    requireVisual(row.key === oldBase || row.key === `${oldBase}|${row.session.attemptId}`, "VISUAL_CLAIM_LOCAL_CONFLICT");
    const current = row.key === oldBase && row.session.attemptId === mapping.activeAttemptId;
    const next: VisualOutbox = { ...row, key: current ? base : `${base}|${row.session.attemptId}`, learner: receipt.learner,
      session: { ...row.session, learner: receipt.learner, recordId: mapping.recordId, activeAttemptId: mapping.activeAttemptId, nextAttemptNumber: mapping.nextAttemptNumber } };
    if (current) {
      const previous = existing.get(base);
      if (previous && previous.session.attemptId !== next.session.attemptId) archive(previous);
      if (previous?.session.attemptId === next.session.attemptId) {
        requireVisual(!hasPendingVisualWork(previous) && !previous.conflict && previous.session.stateRevision === next.session.stateRevision
          && JSON.stringify(previous.snapshot) === JSON.stringify(next.snapshot), "VISUAL_CLAIM_LOCAL_CONFLICT");
        puts.set(base, { ...previous, session: { ...previous.session, nextAttemptNumber: mapping.nextAttemptNumber } });
      } else puts.set(base, next);
    } else archive(next);
    deletes.add(row.key);
  }
  return { puts: [...puts.values()], deletes: [...deletes], journal: { ...journal, phase: "installed" as const, receipt } };
}

import type { VisualOrigin } from "../interactiveVisuals/persistence";

export type LearnerPrincipal = Readonly<{ kind: "account" | "guest"; id: string }>;
/** Only the activity codec knows fields beyond this versioned identity envelope. */
export type VisualSnapshot = Readonly<{ snapshotSchema: number; activityId: string; activityVersion: number; attemptId: string; attemptNumber: number; sequence: number }>;
export type VisualSource = VisualOrigin & Readonly<{ frameworkId?: string; journeyId?: string }>;
export type VisualRecord = {
  recordId: string; principalKey: string; activityId: string; activeAttemptId: string;
  revision: number; attemptCount: number; createdAt: Date; updatedAt: Date;
  claimedFromGuestId?: string;
  /** Retained audit root only. Never a redirect or executable record. */
  claimArchive?: { claimId: string; accountId: string; accountRecordId: string };
};
export type VisualClaimRequest = Readonly<{ claimId: string; foregroundAttemptId: string }>;
export type VisualClaimMapping = Readonly<{
  activityId: string; guestRecordId: string; recordId: string; guestActiveAttemptId: string;
  activeAttemptId: string; nextAttemptNumber: number;
}>;
export type VisualGuestClaim = {
  claimId: string; guestId: string; accountId: string; foregroundAttemptId: string;
  recordIds: string[]; mappings: VisualClaimMapping[]; createdAt: Date; completedAt?: Date;
};
export type VisualClaimReceipt = Readonly<{ claimId: string; learner: string; guestLearner: string; foregroundAttemptId: string; mappings: readonly VisualClaimMapping[] }>;
export type VisualAttempt = {
  attemptId: string; recordId: string; activityId: string; attemptNumber: number;
  startedRelease: number; activityVersion: number; snapshotSchema: number;
  snapshot: unknown; stateRevision: number;
  lastAcceptedWrite: { id: string; hash: string; revision: number } | null;
  command?: { id: string; hash: string; previousAttemptId?: string };
  createdAt: Date; updatedAt: Date; firstCompletedAt?: Date;
};
export type VisualEventInput = Readonly<{
  eventId: string; writerId: string; clientSequence: number; clientOccurredAt: string;
  activityVersion: number; eventSchema: number; type: string; payload: Readonly<Record<string, unknown>>;
}>;
export type StoredVisualEvent = VisualEventInput & {
  attemptId: string; visitId: string; serverReceivedAt: Date; hash: string;
  validation?: "known-codec" | "opaque-history";
};
export type VisualVisit = {
  visitId: string; attemptId: string; principalKindAtAccess: LearnerPrincipal["kind"];
  source: VisualSource; openedAt: Date;
};
export type VisualBatch = Readonly<{
  writeId: string; expectedStateRevision: number; visitId: string;
  activityVersion: number; snapshotSchema: number; events: readonly VisualEventInput[]; snapshot: unknown;
}>;
export type ValidatedVisualBatch = VisualBatch & Readonly<{ snapshot: VisualSnapshot }>;
export type RecoveryAcknowledgement = Readonly<{ writeId: string; acceptedEventIds: readonly string[]; checkpointAccepted: true; validation: "known-codec" | "opaque-history" }>;
export type VisualCheckpoint = {
  checkpointId: string; attemptId: string; activityId: string; reason: "pre-migration" | "restore-recovery";
  sourceActivityVersion: number; sourceSnapshotSchema: number; sourceStateRevision: number;
  targetActivityVersion: number; targetSnapshotSchema: number; targetStateRevision?: number;
  snapshot: unknown; hash: string; createdAt: Date; migrationOnly: boolean;
  visitId?: string; eventIds?: readonly string[]; validation?: "known-codec" | "opaque-history";
};
export type ClientMigrationCheckpoint = Readonly<{
  checkpointId: string; activityVersion: number; snapshotSchema: number; targetActivityVersion: number; targetSnapshotSchema: number;
  stateRevision: number; visitId: string; snapshot: unknown;
}>;
export type BatchAcknowledgement = Readonly<{
  writeId: string; acceptedEventIds: readonly string[]; snapshotAccepted: boolean;
  stateRevision: number; conflict: boolean;
}>;
export type NewVisualAttempt = Readonly<{
  commandId: string; attemptId: string; expectedActiveAttemptId: string;
}>;

import type { IntegrationSnapshot } from "../../app/step-visuals/activities/integration-area/hostState";
import type { RootsSnapshot } from "../../app/step-visuals/activities/roots-factors/hostState";
import type { VisualOrigin } from "../interactiveVisuals/persistence";

export type LearnerPrincipal = Readonly<{ kind: "account" | "guest"; id: string }>;
export type VisualSnapshot = RootsSnapshot | IntegrationSnapshot;
export type VisualSource = VisualOrigin & Readonly<{ frameworkId?: string; journeyId?: string }>;
export type VisualRecord = {
  recordId: string; principalKey: string; activityId: string; activeAttemptId: string;
  revision: number; attemptCount: number; createdAt: Date; updatedAt: Date;
};
export type VisualAttempt = {
  attemptId: string; recordId: string; activityId: string; attemptNumber: number;
  startedRelease: number; activityVersion: number; snapshotSchema: number;
  snapshot: VisualSnapshot | null; stateRevision: number;
  lastAcceptedWrite: { id: string; hash: string; revision: number } | null;
  command?: { id: string; hash: string };
  createdAt: Date; updatedAt: Date; firstCompletedAt?: Date;
};
export type VisualEventInput = Readonly<{
  eventId: string; writerId: string; clientSequence: number; clientOccurredAt: string;
  activityVersion: number; eventSchema: number; type: string; payload: Readonly<Record<string, unknown>>;
}>;
export type StoredVisualEvent = VisualEventInput & {
  attemptId: string; visitId: string; serverReceivedAt: Date; hash: string;
};
export type VisualVisit = {
  visitId: string; attemptId: string; principalKindAtAccess: LearnerPrincipal["kind"];
  source: VisualSource; openedAt: Date;
};
export type VisualBatch = Readonly<{
  writeId: string; expectedStateRevision: number; visitId: string;
  activityVersion: number; snapshotSchema: number; events: readonly VisualEventInput[]; snapshot: VisualSnapshot;
}>;
export type BatchAcknowledgement = Readonly<{
  writeId: string; acceptedEventIds: readonly string[]; snapshotAccepted: boolean;
  stateRevision: number; conflict: boolean;
}>;
export type NewVisualAttempt = Readonly<{
  commandId: string; attemptId: string; expectedActiveAttemptId: string;
}>;

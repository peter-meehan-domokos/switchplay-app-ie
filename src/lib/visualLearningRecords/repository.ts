import { createHash, randomUUID } from "node:crypto";
import { MongoServerError, type ClientSession, type Db, type MongoClient } from "mongodb";
import { withMongoTransaction } from "../mongodb";
import { resolveInteractiveVisual } from "../interactiveVisuals/catalogue";
import { assertNewVisualAttempt, assertUuid, assertVisualBatch, assertVisualSource, principalKey, requireVisual, VisualRecordError } from "./contracts";
import type { BatchAcknowledgement, LearnerPrincipal, NewVisualAttempt, StoredVisualEvent, VisualAttempt, VisualBatch, VisualRecord, VisualSource, VisualVisit } from "./model";

export const VISUAL_COLLECTIONS = { records: "visualRecords", attempts: "visualAttempts", events: "visualEvents", visits: "visualVisits" } as const;
export const VISUAL_INDEXES = [
  { collection: VISUAL_COLLECTIONS.records, key: { recordId: 1 }, name: "visual_record_id", unique: true },
  { collection: VISUAL_COLLECTIONS.records, key: { principalKey: 1, activityId: 1 }, name: "visual_learner_activity", unique: true },
  { collection: VISUAL_COLLECTIONS.attempts, key: { attemptId: 1 }, name: "visual_attempt_id", unique: true },
  { collection: VISUAL_COLLECTIONS.attempts, key: { recordId: 1, createdAt: 1, attemptId: 1 }, name: "visual_attempt_history", unique: false },
  { collection: VISUAL_COLLECTIONS.attempts, key: { recordId: 1, "command.id": 1 }, name: "visual_attempt_command", unique: false },
  { collection: VISUAL_COLLECTIONS.events, key: { attemptId: 1, eventId: 1 }, name: "visual_event_identity", unique: true },
  { collection: VISUAL_COLLECTIONS.events, key: { attemptId: 1, serverReceivedAt: 1, eventId: 1 }, name: "visual_event_history", unique: false },
  { collection: VISUAL_COLLECTIONS.visits, key: { visitId: 1 }, name: "visual_visit_id", unique: true },
  { collection: VISUAL_COLLECTIONS.visits, key: { attemptId: 1, openedAt: 1 }, name: "visual_visit_history", unique: false },
] as const;

/** Explicit deployment setup only; importing this module never connects or creates indexes. */
export async function createVisualLearningRecordIndexes(db: Db) {
  for (const { collection, key, name, unique } of VISUAL_INDEXES) await db.collection(collection).createIndex(key, { name, unique });
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, v]) => `${JSON.stringify(key)}:${canonical(v)}`).join(",")}}`;
  return JSON.stringify(value);
}
const hash = (value: unknown) => createHash("sha256").update(canonical(value)).digest("hex");

export class VisualLearningRecordRepository {
  private ready?: Promise<void>;
  constructor(readonly db: Db, readonly client: MongoClient, readonly disabledIds: readonly string[] = []) {}
  records() { return this.db.collection<VisualRecord>(VISUAL_COLLECTIONS.records); }
  attempts() { return this.db.collection<VisualAttempt>(VISUAL_COLLECTIONS.attempts); }
  events() { return this.db.collection<StoredVisualEvent>(VISUAL_COLLECTIONS.events); }
  visits() { return this.db.collection<VisualVisit>(VISUAL_COLLECTIONS.visits); }
  async assertIndexesReady() {
    this.ready ??= (async () => {
      for (const index of VISUAL_INDEXES) {
        const installed = await this.db.collection(index.collection).listIndexes().toArray();
        requireVisual(installed.some(i => i.name === index.name && canonical(i.key) === canonical(index.key)
          && !!i.unique === index.unique && !i.sparse && !i.partialFilterExpression), "VISUAL_INDEX_SETUP_REQUIRED");
      }
    })().catch(() => { this.ready = undefined; throw new VisualRecordError("VISUAL_INDEX_SETUP_REQUIRED"); });
    await this.ready;
  }
  private release(activityId: string) {
    const release = resolveInteractiveVisual(activityId, { disabledIds: this.disabledIds });
    requireVisual(release, "VISUAL_UNAVAILABLE"); return release;
  }
  private async transaction<T>(operation: (session: ClientSession) => Promise<T>) {
    await this.assertIndexesReady();
    return withMongoTransaction(this.client, operation);
  }
  private async ownedRecord(actor: LearnerPrincipal, recordId: string, session: ClientSession) {
    const record = await this.records().findOne({ recordId, principalKey: principalKey(actor) }, { session });
    requireVisual(record, "VISUAL_RECORD_FORBIDDEN"); return record;
  }
  private async ownedAttempt(actor: LearnerPrincipal, attemptId: string, session: ClientSession) {
    const attempt = await this.attempts().findOne({ attemptId }, { session });
    requireVisual(attempt, "VISUAL_RECORD_FORBIDDEN");
    const record = await this.ownedRecord(actor, attempt.recordId, session);
    requireVisual(record.activityId === attempt.activityId, "VISUAL_STORAGE_INCONSISTENT");
    return { record, attempt };
  }
  private attempt(record: VisualRecord, attemptId: string, now: Date, command?: VisualAttempt["command"]): VisualAttempt {
    const release = this.release(record.activityId);
    return { attemptId, recordId: record.recordId, activityId: record.activityId, attemptNumber: record.attemptCount,
      startedRelease: release.activityVersion, activityVersion: release.activityVersion, snapshotSchema: release.snapshotSchema,
      snapshot: null, stateRevision: 0, lastAcceptedWrite: null, createdAt: now, updatedAt: now, ...(command ? { command } : {}) };
  }
  /** Caller must authorize source against stored card/framework content before calling. Source never grants record access. */
  async open(actor: LearnerPrincipal, activityId: string, visitId: string, source: VisualSource) {
    const key = principalKey(actor); assertUuid(visitId); assertVisualSource(source); this.release(activityId);
    // Initial opens can race on the unique learner/activity key. Retry lookup after the losing insert rolls back.
    for (let retry = 0; ; retry++) {
      try {
        return await this.transaction(async session => {
          const existingVisit = await this.visits().findOne({ visitId }, { session });
          if (existingVisit) {
            const owned = await this.ownedAttempt(actor, existingVisit.attemptId, session);
            requireVisual(owned.record.activityId === activityId && hash(existingVisit.source) === hash(source), "VISUAL_VISIT_ID_CONFLICT");
            return { ...owned, visit: existingVisit };
          }
          const now = new Date();
          let record = await this.records().findOne({ principalKey: key, activityId }, { session });
          if (!record) {
            const fresh: VisualRecord = { recordId: randomUUID(), principalKey: key, activityId, activeAttemptId: randomUUID(), revision: 0, attemptCount: 1, createdAt: now, updatedAt: now };
            await this.records().insertOne(fresh, { session });
            await this.attempts().insertOne(this.attempt(fresh, fresh.activeAttemptId, now), { session });
            record = await this.records().findOne({ recordId: fresh.recordId }, { session });
          }
          requireVisual(record, "VISUAL_STORAGE_INCONSISTENT");
          const attempt = await this.attempts().findOne({ attemptId: record.activeAttemptId, recordId: record.recordId }, { session });
          requireVisual(attempt, "VISUAL_STORAGE_INCONSISTENT");
          const visit: VisualVisit = { visitId, attemptId: attempt.attemptId, principalKindAtAccess: actor.kind, source: structuredClone(source), openedAt: now };
          await this.visits().insertOne(visit, { session });
          await this.records().updateOne({ recordId: record.recordId, principalKey: key }, { $inc: { revision: 1 }, $set: { updatedAt: now } }, { session });
          return { record: { ...record, revision: record.revision + 1, updatedAt: now }, attempt, visit };
        });
      } catch (error) {
        if (error instanceof MongoServerError && error.code === 11000 && retry < 2) continue;
        throw error;
      }
    }
  }
  async current(actor: LearnerPrincipal, recordId: string) {
    assertUuid(recordId);
    return this.transaction(async session => {
      const record = await this.ownedRecord(actor, recordId, session);
      const attempt = await this.attempts().findOne({ attemptId: record.activeAttemptId, recordId }, { session });
      requireVisual(attempt, "VISUAL_STORAGE_INCONSISTENT"); return { record, attempt };
    });
  }
  async newAttempt(actor: LearnerPrincipal, recordId: string, command: NewVisualAttempt) {
    assertUuid(recordId); assertNewVisualAttempt(command); const commandHash = hash(command);
    return this.transaction(async session => {
      const record = await this.ownedRecord(actor, recordId, session); this.release(record.activityId);
      const previous = await this.attempts().findOne({ recordId, "command.id": command.commandId }, { session });
      if (previous) { requireVisual(previous.command?.hash === commandHash, "VISUAL_COMMAND_ID_CONFLICT"); return previous; }
      requireVisual(record.activeAttemptId === command.expectedActiveAttemptId, "VISUAL_ACTIVE_ATTEMPT_CONFLICT");
      requireVisual(!(await this.attempts().findOne({ attemptId: command.attemptId }, { session })), "VISUAL_ATTEMPT_ID_CONFLICT");
      const now = new Date(), attempt = this.attempt({ ...record, attemptCount: record.attemptCount + 1 }, command.attemptId, now, { id: command.commandId, hash: commandHash });
      await this.attempts().insertOne(attempt, { session });
      const updated = await this.records().updateOne({ recordId, principalKey: principalKey(actor), activeAttemptId: command.expectedActiveAttemptId },
        { $set: { activeAttemptId: attempt.attemptId, updatedAt: now }, $inc: { attemptCount: 1, revision: 1 } }, { session });
      requireVisual(updated.modifiedCount === 1, "VISUAL_ACTIVE_ATTEMPT_CONFLICT"); return attempt;
    });
  }
  async append(actor: LearnerPrincipal, attemptId: string, batch: VisualBatch): Promise<BatchAcknowledgement> {
    assertUuid(attemptId);
    return this.transaction(async session => {
      const { record, attempt } = await this.ownedAttempt(actor, attemptId, session); const release = this.release(attempt.activityId);
      assertVisualBatch(batch, attempt.activityId, attemptId);
      requireVisual(batch.snapshot.attemptNumber === attempt.attemptNumber && batch.events.every(e => e.payload.attemptNumber === attempt.attemptNumber
        && Number(e.payload.sequence) <= batch.snapshot.sequence), "VISUAL_SNAPSHOT_IDENTITY_MISMATCH");
      requireVisual(attempt.activityVersion === release.activityVersion && attempt.snapshotSchema === release.snapshotSchema, "VISUAL_RELEASE_MISMATCH");
      requireVisual(await this.visits().findOne({ visitId: batch.visitId, attemptId }, { session }), "VISUAL_VISIT_FORBIDDEN");
      const writeHash = hash(batch), last = attempt.lastAcceptedWrite;
      if (last?.id === batch.writeId) requireVisual(last.hash === writeHash, "VISUAL_WRITE_ID_CONFLICT");
      const now = new Date(); let completed = false;
      for (const event of batch.events) {
        const contentHash = hash(event), previous = await this.events().findOne({ attemptId, eventId: event.eventId }, { session });
        if (previous) requireVisual(previous.hash === contentHash && previous.visitId === batch.visitId, "VISUAL_EVENT_ID_CONFLICT");
        else await this.events().insertOne({ ...event, attemptId, visitId: batch.visitId, serverReceivedAt: now, hash: contentHash }, { session });
        if (event.type === "attempt-completed") completed = true;
      }
      const replay = last?.id === batch.writeId;
      const accepted = replay || batch.expectedStateRevision === attempt.stateRevision;
      if (accepted && !replay) requireVisual(batch.snapshot.sequence >= (attempt.snapshot?.sequence ?? 0), "VISUAL_SEQUENCE_REGRESSION");
      const revision = accepted && !replay ? attempt.stateRevision + 1 : attempt.stateRevision;
      await this.attempts().updateOne({ attemptId, recordId: record.recordId, stateRevision: attempt.stateRevision }, { $set: {
        updatedAt: now,
        ...(accepted && !replay ? { snapshot: structuredClone(batch.snapshot), stateRevision: revision, lastAcceptedWrite: { id: batch.writeId, hash: writeHash, revision } } : {}),
        ...(completed && !attempt.firstCompletedAt ? { firstCompletedAt: now } : {}),
      } }, { session });
      // Record is the claim/new-attempt serialization point; never replace its active pointer in a batch.
      await this.records().updateOne({ recordId: record.recordId, principalKey: principalKey(actor) }, { $inc: { revision: 1 }, $set: { updatedAt: now } }, { session });
      return { writeId: batch.writeId, acceptedEventIds: batch.events.map(e => e.eventId), snapshotAccepted: accepted, stateRevision: revision, conflict: !accepted };
    });
  }
}

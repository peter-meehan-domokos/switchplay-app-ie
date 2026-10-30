import { createHash, randomUUID } from "node:crypto";
import { MongoServerError, type ClientSession, type Db, type MongoClient } from "mongodb";
import { withMongoTransaction } from "../mongodb";
import { resolveInteractiveVisual } from "../interactiveVisuals/catalogue";
import { assertBoundedJson, assertNewVisualAttempt, assertUuid, assertVisualBatch, assertVisualRecoveryEnvelope, assertVisualSnapshot, assertVisualSource, exactFields, principalKey, recordObject, requireVisual, safeCount, VisualRecordError } from "./contracts";
import type { BatchAcknowledgement, LearnerPrincipal, NewVisualAttempt, RecoveryAcknowledgement, StoredVisualEvent, VisualAttempt, VisualBatch, VisualCheckpoint, VisualEventInput, VisualRecord, VisualSnapshot, VisualSource, VisualVisit } from "./model";
import { inspectVisualRestoration, storedVisualSnapshotValid } from "./restoration";
import { compiledVisualCodecs, visualCodec } from "./codecs";
import { compiledVisualMigrations, convertVisualSnapshot, findVisualMigration, type VisualVersionPolicy } from "./migrations";

export const VISUAL_COLLECTIONS = { records: "visualRecords", attempts: "visualAttempts", events: "visualEvents", visits: "visualVisits", checkpoints: "visualSnapshotCheckpoints" } as const;
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
  { collection: VISUAL_COLLECTIONS.checkpoints, key: { checkpointId: 1 }, name: "visual_checkpoint_id", unique: true },
  { collection: VISUAL_COLLECTIONS.checkpoints, key: { attemptId: 1, createdAt: 1, checkpointId: 1 }, name: "visual_checkpoint_history", unique: false },
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
const readiness = new WeakMap<MongoClient, Map<string, Promise<void>>>();

export class VisualLearningRecordRepository {
  constructor(readonly db: Db, readonly client: MongoClient, readonly disabledIds: readonly string[] = [], readonly versions: VisualVersionPolicy = {}) {}
  get codecs() { return this.versions.codecs ?? compiledVisualCodecs; }
  get migrations() { return this.versions.migrations ?? compiledVisualMigrations; }
  records() { return this.db.collection<VisualRecord>(VISUAL_COLLECTIONS.records); }
  attempts() { return this.db.collection<VisualAttempt>(VISUAL_COLLECTIONS.attempts); }
  events() { return this.db.collection<StoredVisualEvent>(VISUAL_COLLECTIONS.events); }
  visits() { return this.db.collection<VisualVisit>(VISUAL_COLLECTIONS.visits); }
  checkpoints() { return this.db.collection<VisualCheckpoint>(VISUAL_COLLECTIONS.checkpoints); }
  async assertIndexesReady() {
    let databases = readiness.get(this.client);
    if (!databases) { databases = new Map(); readiness.set(this.client, databases); }
    let ready = databases.get(this.db.databaseName);
    if (!ready) { ready = (async () => {
      for (const index of VISUAL_INDEXES) {
        const installed = await this.db.collection(index.collection).listIndexes().toArray();
        requireVisual(installed.some(i => i.name === index.name && canonical(i.key) === canonical(index.key)
          && !!i.unique === index.unique && !i.sparse && !i.partialFilterExpression), "VISUAL_INDEX_SETUP_REQUIRED");
      }
    })().catch(() => { databases!.delete(this.db.databaseName); throw new VisualRecordError("VISUAL_INDEX_SETUP_REQUIRED"); });
      databases.set(this.db.databaseName, ready);
    }
    await ready;
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
  private async checkpoint(value: VisualCheckpoint, session: ClientSession) {
    const existing = await this.checkpoints().findOne({ checkpointId: value.checkpointId }, { session });
    if (existing) requireVisual(existing.hash === value.hash && existing.attemptId === value.attemptId, "VISUAL_CHECKPOINT_CONFLICT");
    else await this.checkpoints().insertOne(value, { session });
  }
  private async migrateForOpen(attempt: VisualAttempt, session: ClientSession): Promise<VisualAttempt> {
    const release = this.release(attempt.activityId);
    if (attempt.activityVersion === release.activityVersion && attempt.snapshotSchema === release.snapshotSchema) return attempt;
    const path = findVisualMigration(attempt.activityId, attempt.activityVersion, attempt.snapshotSchema, release, this.migrations);
    if (!path || !storedVisualSnapshotValid(attempt, this.codecs)) return attempt;
    let snapshot: VisualSnapshot | null;
    try { snapshot = convertVisualSnapshot(attempt.snapshot, path, attempt.attemptId, this.codecs); }
    catch { return attempt; } // Preserve unsafe history and use the explicit recovery path.
    const revision = attempt.stateRevision + 1, now = new Date();
    await this.checkpoint({ checkpointId: `open-${attempt.attemptId}-${attempt.stateRevision}-${release.activityVersion}-${release.snapshotSchema}`,
      attemptId: attempt.attemptId, activityId: attempt.activityId, reason: "pre-migration", sourceActivityVersion: attempt.activityVersion,
      sourceSnapshotSchema: attempt.snapshotSchema, sourceStateRevision: attempt.stateRevision, targetActivityVersion: release.activityVersion,
      targetSnapshotSchema: release.snapshotSchema, targetStateRevision: revision, snapshot: attempt.snapshot, hash: hash(attempt.snapshot), createdAt: now, migrationOnly: true }, session);
    const changes = { snapshot, activityVersion: release.activityVersion, snapshotSchema: release.snapshotSchema, stateRevision: revision, updatedAt: now,
      lastAcceptedWrite: attempt.lastAcceptedWrite ? { ...attempt.lastAcceptedWrite, revision } : null };
    await this.attempts().updateOne({ attemptId: attempt.attemptId, stateRevision: attempt.stateRevision }, { $set: changes }, { session });
    return { ...attempt, ...changes };
  }
  private async appendEvents(attemptId: string, visitId: string, events: readonly VisualEventInput[], validation: "known-codec" | "opaque-history", now: Date, session: ClientSession) {
    let completed = false;
    for (const event of events) {
      const contentHash = hash(event), previous = await this.events().findOne({ attemptId, eventId: event.eventId }, { session });
      if (previous) {
        requireVisual(previous.hash === contentHash && previous.visitId === visitId, "VISUAL_EVENT_ID_CONFLICT");
        if (validation === "known-codec" && previous.validation === "opaque-history") await this.events().updateOne({ attemptId, eventId: event.eventId }, { $set: { validation } }, { session });
      } else await this.events().insertOne({ ...event, attemptId, visitId, serverReceivedAt: now, hash: contentHash, validation }, { session });
      if (validation === "known-codec" && event.type === "attempt-completed") completed = true;
    }
    return completed;
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
            const attempt = owned.record.activeAttemptId === owned.attempt.attemptId ? await this.migrateForOpen(owned.attempt, session) : owned.attempt;
            return { ...owned, attempt, visit: existingVisit };
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
          const stored = await this.attempts().findOne({ attemptId: record.activeAttemptId, recordId: record.recordId }, { session });
          requireVisual(stored, "VISUAL_STORAGE_INCONSISTENT");
          const attempt = await this.migrateForOpen(stored, session);
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
      const now = new Date(), attempt = this.attempt({ ...record, attemptCount: record.attemptCount + 1 }, command.attemptId, now,
        { id: command.commandId, hash: commandHash, previousAttemptId: command.expectedActiveAttemptId });
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
      assertVisualBatch(batch, attempt.activityId, attemptId, this.codecs);
      requireVisual(batch.snapshot.attemptNumber === attempt.attemptNumber && batch.events.every(e => e.payload.attemptNumber === attempt.attemptNumber
        && Number(e.payload.sequence) <= batch.snapshot.sequence), "VISUAL_SNAPSHOT_IDENTITY_MISMATCH");
      requireVisual(storedVisualSnapshotValid(attempt, this.codecs), "VISUAL_RESTORATION_REQUIRED");
      requireVisual(await this.visits().findOne({ visitId: batch.visitId, attemptId }, { session }), "VISUAL_VISIT_FORBIDDEN");
      const writeHash = hash(batch), last = attempt.lastAcceptedWrite;
      if (last?.id === batch.writeId) requireVisual(last.hash === writeHash, "VISUAL_WRITE_ID_CONFLICT");
      const now = new Date(), completed = await this.appendEvents(attemptId, batch.visitId, batch.events, "known-codec", now, session);
      const replay = last?.id === batch.writeId;
      let candidate = batch.snapshot;
      const path = findVisualMigration(attempt.activityId, batch.activityVersion, batch.snapshotSchema, release, this.migrations);
      if (path && !replay) {
        const converted = convertVisualSnapshot(candidate, path, attemptId, this.codecs);
        requireVisual(converted !== null, "INVALID_VISUAL_SNAPSHOT"); candidate = converted;
      }
      const sameFormat = candidate.activityVersion === attempt.activityVersion && candidate.snapshotSchema === attempt.snapshotSchema;
      const upgrade = candidate.activityVersion === release.activityVersion && candidate.snapshotSchema === release.snapshotSchema
        && !!findVisualMigration(attempt.activityId, attempt.activityVersion, attempt.snapshotSchema, release, this.migrations);
      // Bridge a format-only revision, never a revision containing another learner action.
      const bridge = !sameFormat && !upgrade ? false : batch.expectedStateRevision !== attempt.stateRevision
        && !!await this.checkpoints().findOne({ attemptId, reason: "pre-migration", migrationOnly: true,
          sourceStateRevision: batch.expectedStateRevision, targetStateRevision: attempt.stateRevision,
          targetActivityVersion: candidate.activityVersion, targetSnapshotSchema: candidate.snapshotSchema }, { session });
      const accepted = replay || (sameFormat || upgrade) && (batch.expectedStateRevision === attempt.stateRevision || bridge);
      const storedSequence = recordObject(attempt.snapshot) && safeCount(attempt.snapshot.sequence) ? attempt.snapshot.sequence : 0;
      if (accepted && !replay) requireVisual(candidate.sequence >= storedSequence, "VISUAL_SEQUENCE_REGRESSION");
      const revision = accepted && !replay ? attempt.stateRevision + 1 : attempt.stateRevision;
      if (accepted && !replay && !sameFormat) {
        await this.checkpoint({ checkpointId: `write-${attemptId}-${attempt.stateRevision}-${candidate.activityVersion}-${candidate.snapshotSchema}`, attemptId,
          activityId: attempt.activityId, reason: "pre-migration", sourceActivityVersion: attempt.activityVersion, sourceSnapshotSchema: attempt.snapshotSchema,
          sourceStateRevision: attempt.stateRevision, targetActivityVersion: candidate.activityVersion, targetSnapshotSchema: candidate.snapshotSchema,
          targetStateRevision: revision, snapshot: attempt.snapshot, hash: hash(attempt.snapshot), createdAt: now, migrationOnly: false }, session);
      }
      if (accepted && !replay && path) await this.checkpoint({ checkpointId: `received-${attemptId}-${batch.writeId}`, attemptId, activityId: attempt.activityId, reason: "pre-migration",
          sourceActivityVersion: batch.activityVersion, sourceSnapshotSchema: batch.snapshotSchema, sourceStateRevision: batch.expectedStateRevision,
          targetActivityVersion: candidate.activityVersion, targetSnapshotSchema: candidate.snapshotSchema, targetStateRevision: revision,
          snapshot: batch.snapshot, hash: hash(batch.snapshot), createdAt: now, migrationOnly: false }, session);
      await this.attempts().updateOne({ attemptId, recordId: record.recordId, stateRevision: attempt.stateRevision }, { $set: {
        updatedAt: now,
        ...(accepted && !replay ? { snapshot: structuredClone(candidate), activityVersion: candidate.activityVersion, snapshotSchema: candidate.snapshotSchema,
          stateRevision: revision, lastAcceptedWrite: { id: batch.writeId, hash: writeHash, revision } } : {}),
        ...(completed && !attempt.firstCompletedAt ? { firstCompletedAt: now } : {}),
      } }, { session });
      // Record is the claim/new-attempt serialization point; never replace its active pointer in a batch.
      await this.records().updateOne({ recordId: record.recordId, principalKey: principalKey(actor) }, { $inc: { revision: 1 }, $set: { updatedAt: now } }, { session });
      return { writeId: batch.writeId, acceptedEventIds: batch.events.map(e => e.eventId), snapshotAccepted: accepted, stateRevision: revision, conflict: !accepted };
    });
  }
  async preserveRecovery(actor: LearnerPrincipal, attemptId: string, batch: VisualBatch): Promise<RecoveryAcknowledgement> {
    assertUuid(attemptId);
    return this.transaction(async session => {
      const { record, attempt } = await this.ownedAttempt(actor, attemptId, session), release = this.release(attempt.activityId);
      assertVisualRecoveryEnvelope(batch, attempt.activityId, attemptId);
      const checkpointId = `recovery-${attemptId}-${batch.writeId}`;
      const previous = await this.checkpoints().findOne({ checkpointId }, { session });
      // A lost backup acknowledgement remains retryable even if a later safe
      // rollback makes the old attempt restorable again.
      requireVisual(previous || inspectVisualRestoration(attempt, release).status === "new-attempt-required", "VISUAL_RECOVERY_NOT_REQUIRED");
      if (previous) requireVisual(previous.hash === hash(batch), "VISUAL_CHECKPOINT_CONFLICT");
      requireVisual(batch.events.every(e => e.payload.attemptNumber === attempt.attemptNumber), "VISUAL_SNAPSHOT_IDENTITY_MISMATCH");
      if (recordObject(batch.snapshot) && batch.snapshot.attemptNumber !== undefined) requireVisual(batch.snapshot.attemptNumber === attempt.attemptNumber, "VISUAL_SNAPSHOT_IDENTITY_MISMATCH");
      requireVisual(await this.visits().findOne({ visitId: batch.visitId, attemptId }, { session }), "VISUAL_VISIT_FORBIDDEN");
      let validation: "known-codec" | "opaque-history" = previous?.validation ?? "opaque-history";
      if (!previous) {
        try { assertVisualBatch(batch, attempt.activityId, attemptId, this.codecs); validation = "known-codec"; } catch { /* Preserve bounded unknown history without interpreting it. */ }
      }
      const now = new Date(), completed = await this.appendEvents(attemptId, batch.visitId, batch.events, validation, now, session);
      await this.checkpoint({ checkpointId, attemptId, activityId: attempt.activityId, reason: "restore-recovery",
        sourceActivityVersion: batch.activityVersion, sourceSnapshotSchema: batch.snapshotSchema, sourceStateRevision: batch.expectedStateRevision,
        targetActivityVersion: release.activityVersion, targetSnapshotSchema: release.snapshotSchema, snapshot: batch.snapshot, hash: hash(batch),
        createdAt: now, migrationOnly: false, visitId: batch.visitId, eventIds: batch.events.map(e => e.eventId), validation }, session);
      if (completed && !attempt.firstCompletedAt) await this.attempts().updateOne({ attemptId }, { $set: { firstCompletedAt: now, updatedAt: now } }, { session });
      await this.records().updateOne({ recordId: record.recordId, principalKey: principalKey(actor) }, { $inc: { revision: 1 }, $set: { updatedAt: now } }, { session });
      return { writeId: batch.writeId, acceptedEventIds: batch.events.map(e => e.eventId), checkpointAccepted: true, validation };
    });
  }
  async preserveMigration(actor: LearnerPrincipal, attemptId: string, body: unknown) {
    assertUuid(attemptId); assertBoundedJson(body);
    requireVisual(recordObject(body) && exactFields(body, ["checkpointId", "activityVersion", "snapshotSchema", "targetActivityVersion", "targetSnapshotSchema", "stateRevision", "visitId", "snapshot"]), "INVALID_VISUAL_CHECKPOINT");
    assertUuid(body.checkpointId); assertUuid(body.visitId);
    requireVisual(safeCount(body.activityVersion) && safeCount(body.snapshotSchema) && safeCount(body.stateRevision)
      && safeCount(body.targetActivityVersion) && safeCount(body.targetSnapshotSchema), "INVALID_VISUAL_CHECKPOINT");
    return this.transaction(async session => {
      const { record, attempt } = await this.ownedAttempt(actor, attemptId, session), release = this.release(attempt.activityId);
      // A queued checkpoint may target a retained intermediate release after a
      // later publication. It is history, never an instruction to downgrade.
      const target = { ...release, activityVersion: body.targetActivityVersion as number, snapshotSchema: body.targetSnapshotSchema as number };
      requireVisual(visualCodec(attempt.activityId, target.activityVersion, target.snapshotSchema, this.codecs)
        && findVisualMigration(attempt.activityId, body.activityVersion as number, body.snapshotSchema as number, target, this.migrations), "VISUAL_RELEASE_MISMATCH");
      const codec = visualCodec(attempt.activityId, body.activityVersion as number, body.snapshotSchema as number, this.codecs);
      requireVisual(codec, "VISUAL_RELEASE_MISMATCH"); assertVisualSnapshot(body.snapshot, attempt.activityId, attemptId, codec);
      requireVisual(body.snapshot.attemptNumber === attempt.attemptNumber, "VISUAL_SNAPSHOT_IDENTITY_MISMATCH");
      requireVisual(await this.visits().findOne({ visitId: body.visitId as string, attemptId }, { session }), "VISUAL_VISIT_FORBIDDEN");
      await this.checkpoint({ checkpointId: `client-${attemptId}-${body.checkpointId}`, attemptId, activityId: attempt.activityId, reason: "pre-migration",
        sourceActivityVersion: body.activityVersion as number, sourceSnapshotSchema: body.snapshotSchema as number, sourceStateRevision: body.stateRevision as number,
        targetActivityVersion: target.activityVersion, targetSnapshotSchema: target.snapshotSchema, snapshot: body.snapshot, hash: hash(body),
        createdAt: new Date(), migrationOnly: false, visitId: body.visitId as string, validation: "known-codec" }, session);
      await this.records().updateOne({ recordId: record.recordId, principalKey: principalKey(actor) }, { $inc: { revision: 1 } }, { session });
      return { checkpointId: body.checkpointId, checkpointAccepted: true };
    });
  }
}

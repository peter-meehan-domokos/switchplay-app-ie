import type { InteractiveVisualRelease } from "../interactiveVisuals/catalogue";
import { compiledVisualCodecs, visualCodec, type VisualCodec } from "./codecs";
import { assertBoundedJson, assertVisualSnapshot, requireVisual } from "./contracts";
import type { VisualSnapshot } from "./model";

export type VisualMigration = Readonly<{
  activityId: string; fromVersion: number; fromSchema: number; toVersion: number; toSchema: number;
  convert: (snapshot: unknown) => unknown;
}>;
// The first durable releases have no earlier durable format to convert. A future
// publication must retain its old codecs and register reviewed activity-owned paths.
export const compiledVisualMigrations: readonly VisualMigration[] = Object.freeze([]);
export function findVisualMigration(id: string, version: number, schema: number, target: InteractiveVisualRelease, migrations = compiledVisualMigrations) {
  return migrations.find(m => m.activityId === id && m.fromVersion === version && m.fromSchema === schema
    && m.toVersion === target.activityVersion && m.toSchema === target.snapshotSchema);
}
export function convertVisualSnapshot(snapshot: unknown, migration: VisualMigration, attemptId: string, codecs = compiledVisualCodecs): VisualSnapshot | null {
  if (snapshot === null) return null;
  const source = visualCodec(migration.activityId, migration.fromVersion, migration.fromSchema, codecs);
  const target = visualCodec(migration.activityId, migration.toVersion, migration.toSchema, codecs);
  requireVisual(source && target, "VISUAL_MIGRATION_CODEC_MISSING");
  assertVisualSnapshot(snapshot, migration.activityId, attemptId, source);
  const next = migration.convert(structuredClone(snapshot));
  assertBoundedJson(next, 128 * 1024); assertVisualSnapshot(next, migration.activityId, attemptId, target);
  requireVisual(next.attemptNumber === snapshot.attemptNumber && next.sequence === snapshot.sequence, "VISUAL_MIGRATION_IDENTITY_MISMATCH");
  return next;
}
export type VisualVersionPolicy = Readonly<{ codecs?: readonly VisualCodec[]; migrations?: readonly VisualMigration[] }>;

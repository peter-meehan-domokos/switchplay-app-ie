import { compiledVisualCodecs, type VisualCodec } from "../../src/lib/visualLearningRecords/codecs";
import { recordObject } from "../../src/lib/visualLearningRecords/contracts";
import type { VisualMigration } from "../../src/lib/visualLearningRecords/migrations";

// Synthetic historical format used only by tests. No additional curriculum
// release, catalogue entry or production converter is published by this fixture.
const current = compiledVisualCodecs.find(c => c.activityId === "roots-and-factors")!;
export const legacyRootsCodec: VisualCodec = { ...current, activityVersion: 0,
  isSnapshot: value => recordObject(value) && value.activityVersion === 0 && current.isSnapshot({ ...value, activityVersion: 1 }),
  isEvent: value => recordObject(value) && value.activityVersion === 0 && current.isEvent({ ...value, activityVersion: 1 }),
};
export const rootsMigration: VisualMigration = { activityId: current.activityId, fromVersion: 0, fromSchema: 1, toVersion: 1, toSchema: 1,
  convert: value => ({ ...value as Record<string, unknown>, activityVersion: 1 }) };
export const testVersions = { codecs: [...compiledVisualCodecs, legacyRootsCodec], migrations: [rootsMigration] };

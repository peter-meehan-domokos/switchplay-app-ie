import { isRootsSnapshot } from "../../app/step-visuals/activities/roots-factors/hostState";
import { isHostedRootsEvent } from "../../app/step-visuals/activities/roots-factors/eventValidation";
import { isIntegrationSnapshot } from "../../app/step-visuals/activities/integration-area/hostState";
import { isHostedIntegrationEvent } from "../../app/step-visuals/activities/integration-area/eventValidation";

export type VisualCodec = Readonly<{
  activityId: string; activityVersion: number; snapshotSchema: number; eventSchema: number;
  isSnapshot: (value: unknown) => boolean; isEvent: (value: unknown) => boolean;
}>;
// Immutable published decoders. Keep older entries when adding a new release;
// current card references resolve through the separate current-release catalogue.
export const compiledVisualCodecs: readonly VisualCodec[] = Object.freeze([
  Object.freeze({ activityId: "roots-and-factors", activityVersion: 1, snapshotSchema: 1, eventSchema: 1, isSnapshot: isRootsSnapshot, isEvent: isHostedRootsEvent }),
  Object.freeze({ activityId: "integration-area", activityVersion: 2, snapshotSchema: 1, eventSchema: 2, isSnapshot: isIntegrationSnapshot, isEvent: isHostedIntegrationEvent }),
]);
export const visualCodec = (id: string, version: number, schema: number, codecs = compiledVisualCodecs) =>
  codecs.find(c => c.activityId === id && c.activityVersion === version && c.snapshotSchema === schema);
export const visualEventCodec = (id: string, version: number, schema: number, codecs = compiledVisualCodecs) =>
  codecs.find(c => c.activityId === id && c.activityVersion === version && c.eventSchema === schema);

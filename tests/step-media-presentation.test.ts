import assert from "node:assert/strict";
import test from "node:test";
import { selectedStepMedia, stepVideoPreparations } from "../src/lib/stepMediaPresentation";
import type { StepMediaItem } from "../src/lib/stepMedia";

const video = (id: string): StepMediaItem & { kind: "video" } => ({ id, label: "Watch", kind: "video", media: {
  id, mediaType: "video", provider: "cloudflare-stream", assetId: id, src: `https://iframe.videodelivery.net/${id}`, description: id,
} });
test("selection defaults on entry and safely falls back after attachment removal without changing stored order", () => {
  const items = [video("one"), { id: "two", label: "Explore", kind: "activity" as const, activityId: "roots-and-factors" }, video("three")];
  assert.equal(selectedStepMedia({ mediaItems: items })?.id, "one");
  assert.equal(selectedStepMedia({ mediaItems: items }, "two")?.kind, "activity");
  assert.equal(selectedStepMedia({ mediaItems: items }, "removed")?.id, "one");
  assert.equal(selectedStepMedia(undefined), null); assert.equal(selectedStepMedia({ mediaItems: [] }), null);
  assert.equal(selectedStepMedia({ mediaItem: video("legacy").media })?.id, "legacy:legacy");
  assert.deepEqual(items.map(item => item.id), ["one", "two", "three"]);
});
test("legacy preparation stays four videos; multimedia prepares at most seven distinct current/neighbor/first sources", () => {
  const legacy = [0, 1, 2, 3].map(i => ({ mediaItem: video(`legacy-${i}`).media }));
  assert.deepEqual(stepVideoPreparations(legacy).map(item => item.assetId), legacy.map(item => item.mediaItem.assetId));
  const destinations = [0, 1, 2, 3].map(i => ({ mediaItems: [0, 1, 2, 3].map(j => video(`${i}-${j}`)) }));
  assert.equal(stepVideoPreparations(destinations).length, 4);
  const prepared = stepVideoPreparations(destinations, { index: 2, attachmentId: "2-2" }).map(item => item.assetId);
  assert.deepEqual(prepared, ["0-0", "1-0", "2-0", "3-0", "2-1", "2-2", "2-3"]);
  const duplicate = [destinations[0], { mediaItems: [video("0-0"), video("0-0")] }];
  assert.deepEqual(stepVideoPreparations(duplicate, { index: 1 }).map(item => item.assetId), ["0-0"]);
});

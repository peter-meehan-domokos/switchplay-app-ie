import assert from "node:assert/strict";
import test from "node:test";
import { putStepMedia, selectedStepVisual, uploadedStepMedia } from "../src/components/creator/creatorStepMedia";
import type { ImageMediaItem, VideoMediaItem } from "../src/lib/media";
import { stepMediaItems, validStepMediaLabels, withStepMedia } from "../src/lib/stepMedia";

const video: VideoMediaItem = { id: "video", mediaType: "video", provider: "cloudflare-stream", assetId: "test-asset", src: "https://iframe.videodelivery.net/test-asset", description: "Video" };
const image: ImageMediaItem = { id: "image", mediaType: "image", provider: "cloudflare-r2", assetId: "test-image.png", src: "https://example.invalid/test-image.png", description: "A diagram" };
test("creator replacements preserve attachment identity and label while repeated types and ordering stay explicit", () => {
  let items = [selectedStepVisual("roots-and-factors", "one"), selectedStepVisual("roots-and-factors", "two")];
  const previous = { ...items[0], label: "Try" };
  items = putStepMedia(items, previous, previous.id);
  items = putStepMedia(items, uploadedStepMedia(image, previous.id, previous), previous.id);
  assert.equal(items.length, 2); assert.equal(items[0].label, "Try"); assert.equal(items[0].id, "one");
  assert.equal(items[0].kind, "image"); assert.equal(items[1].kind, "activity");
  assert.throws(() => putStepMedia(items, uploadedStepMedia(video, "three"), "gone"), /changed/);
  assert.deepEqual(items.map(item => item.id), ["one", "two"]);
});
test("four-item cap and label contract apply before attaching or persisting a candidate", () => {
  const items = ["one", "two", "three", "four"].map(id => selectedStepVisual("integration-area", id));
  assert.throws(() => putStepMedia(items, selectedStepVisual("integration-area", "five")), /four/);
  assert.throws(() => selectedStepVisual("https://external.invalid", "one"), /published/);
  assert.equal(validStepMediaLabels(["Explore", "Explore", "Watch", "Image"]), true);
  for (const labels of [[""], ["New\nline"], [" leading"], ["1234567890123"], ["123456789012", "123456789012", "123456789012"]]) assert.equal(validStepMediaLabels(labels), false);
});
test("an explicit media edit normalizes a legacy video while retaining every other destination field", () => {
  const old = { title: "Title", description: "Explanation", infoCardIds: ["info"], mediaItem: video };
  const next = withStepMedia(old, putStepMedia(stepMediaItems(old), uploadedStepMedia(image, "new")));
  assert.equal(Object.hasOwn(next, "mediaItem"), false); assert.deepEqual(next.infoCardIds, ["info"]);
  assert.equal(next.mediaItems[0].kind, "video"); assert.equal(next.mediaItems[0].label, "Watch");
  assert.equal(old.mediaItem, video); assert.equal(next.mediaItems[1].label, "Image");
});

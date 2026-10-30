import assert from "node:assert/strict";
import test from "node:test";
import { stepMediaWriteProtocol } from "../src/lib/stepMediaRollout";
import { withCreatorStepMedia, uploadedStepMedia, selectedStepVisual } from "../src/components/creator/creatorStepMedia";
import { assertStepMediaWrite } from "../src/lib/cards/domain";
import { createDefaultCardContent } from "../src/lib/cards/creatorDefaults";
import { stepMediaItems } from "../src/lib/stepMedia";
import type { VideoMediaItem } from "../src/lib/media";

test("new step-media writers require both server rollout gates and the client protocol", () => {
  const content = createDefaultCardContent(["one", "two", "three"]);
  content.intro = withCreatorStepMedia(content.intro, [selectedStepVisual("roots-and-factors", "visual")], true);
  for (const environment of [{}, { SWITCHPLAY_PLUGGED_IN_VISUALS: "1" }, { SWITCHPLAY_STEP_MEDIA_WRITES: "1" }, { SWITCHPLAY_PLUGGED_IN_VISUALS: "0", SWITCHPLAY_STEP_MEDIA_WRITES: "1" }]) {
    assert.throws(() => assertStepMediaWrite(stepMediaWriteProtocol("1", environment), content), /CLIENT_REVISION_REQUIRED/);
  }
  const enabled = { SWITCHPLAY_PLUGGED_IN_VISUALS: "1", SWITCHPLAY_STEP_MEDIA_WRITES: "1" };
  assert.doesNotThrow(() => assertStepMediaWrite(stepMediaWriteProtocol("1", enabled), content));
  assert.throws(() => assertStepMediaWrite(stepMediaWriteProtocol(undefined, enabled), content), /CLIENT_REVISION_REQUIRED/);
});

test("disabled multimedia authoring retains legacy single-video upload serialization and never flattens arrays", () => {
  const media: VideoMediaItem = { id: "video", mediaType: "video", provider: "cloudflare-stream", assetId: "fixture", src: "https://iframe.videodelivery.net/fixture", description: "Existing" };
  const content = createDefaultCardContent(["one", "two", "three"]), original = { ...content.intro, mediaItem: media };
  const item = uploadedStepMedia({ ...media, id: "replacement", assetId: "replacement" }, "slot");
  const replacement = withCreatorStepMedia(original, [item], false);
  assert.ok("mediaItem" in replacement);
  assert.equal(Object.hasOwn(replacement, "mediaItems"), false); assert.equal(replacement.mediaItem?.assetId, "replacement");
  assert.doesNotThrow(() => assertStepMediaWrite(undefined, { ...content, intro: replacement }));
  const removed = withCreatorStepMedia(replacement, [], false); assert.ok("mediaItem" in removed); assert.equal(removed.mediaItem, null);
  const modern = withCreatorStepMedia(original, [item], true);
  assert.throws(() => withCreatorStepMedia(modern, stepMediaItems(modern).slice(), false), /kept/);
  assert.throws(() => withCreatorStepMedia(original, [selectedStepVisual("roots-and-factors", "visual")], false), /kept/);
  assert.deepEqual(original.mediaItem, media);
});

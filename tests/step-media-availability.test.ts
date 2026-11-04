import assert from "node:assert/strict";
import test from "node:test";
import { uploadedStepMedia, selectedStepVisual } from "../src/components/creator/creatorStepMedia";
import { assertStepMediaWrite } from "../src/lib/cards/domain";
import { createDefaultCardContent } from "../src/lib/cards/creatorDefaults";
import { stepMediaItems, withStepMedia } from "../src/lib/stepMedia";
import { interactiveVisualCatalogue } from "../src/lib/interactiveVisuals/catalogue";
import { createVisualApi } from "../src/lib/visualLearningRecords/api";
import type { VisualLearningRecordRepository } from "../src/lib/visualLearningRecords/repository";
import type { VideoMediaItem } from "../src/lib/media";

test("catalogue, Creator selection, modern writes and progress lookup work with both removed variables absent", async t => {
  const names = ["SWITCHPLAY_PLUGGED_IN_VISUALS", "SWITCHPLAY_STEP_MEDIA_WRITES"];
  const previous = names.map(name => process.env[name]); names.forEach(name => { delete process.env[name]; });
  t.after(() => names.forEach((name, index) => { if (previous[index] === undefined) delete process.env[name]; else process.env[name] = previous[index]; }));
  for (const name of names) assert.equal(process.env[name], undefined);
  for (const activityId of ["roots-and-factors", "integration-area"]) {
    assert(interactiveVisualCatalogue.some(entry => entry.id === activityId && entry.status === "published"));
    const content = createDefaultCardContent(["one", "two", "three"]);
    content.intro = withStepMedia(content.intro, [selectedStepVisual(activityId, "visual")]);
    assert.doesNotThrow(() => assertStepMediaWrite("1", content));
    for (const protocol of [undefined, null, "0", "2"]) assert.throws(() => assertStepMediaWrite(protocol, content), /CLIENT_REVISION_REQUIRED/);
    const api = createVisualApi({ authenticate: async () => ({ kind: "account", id: "learner" }),
      repository: async () => ({ hasAttempt: async () => false }) as unknown as VisualLearningRecordRepository,
      authorizeSource: async (_actor, _id, source) => source });
    const response = await api.existing(new Request(`https://app.example/api/visual-sessions/existing?activityId=${activityId}`, { headers: { "X-Visual-Learner": "account:learner" } }));
    assert.equal(response.status, 200); assert.deepEqual(await response.json(), { hasAttempt: false });
  }
});

test("legacy video reads remain intact; edits use ordered media and old writers cannot flatten them", () => {
  const media: VideoMediaItem = { id: "video", mediaType: "video", provider: "cloudflare-stream", assetId: "fixture", src: "https://iframe.videodelivery.net/fixture", description: "Existing" };
  const content = createDefaultCardContent(["one", "two", "three"]), original = { ...content.intro, mediaItem: media };
  assert.equal(stepMediaItems(original)[0].kind, "video");
  assert.doesNotThrow(() => assertStepMediaWrite(undefined, { ...content, intro: original }));
  const item = uploadedStepMedia({ ...media, id: "replacement", assetId: "replacement" }, "slot");
  const modern = withStepMedia(original, [item]);
  assert.equal(Object.hasOwn(modern, "mediaItem"), false); assert.equal(modern.mediaItems![0].kind, "video");
  assert.deepEqual(withStepMedia(modern, []).mediaItems, []);
  assert.throws(() => assertStepMediaWrite(undefined, { ...content, intro: original }, { ...content, intro: modern }), /CLIENT_REVISION_REQUIRED/);
  assert.deepEqual(original.mediaItem, media);
});

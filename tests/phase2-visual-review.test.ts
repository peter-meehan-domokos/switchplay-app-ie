import assert from "node:assert/strict";
import test from "node:test";
import { phase2VisualReviewMediaUrl } from "../src/lib/phase2VisualReviewMedia";
import { visualReviewContents } from "../scripts/fixtures/plugged-in-review";
import { assertCardContent } from "../src/lib/cards/domain";
import { introductionVideo, stepMediaItems } from "../src/lib/stepMedia";

test("local review transport is opt-in, development-only and limited to known local sample IDs", () => {
  const settings = { development: true, enabled: true, origin: "http://192.168.1.38:4183" };
  assert.equal(phase2VisualReviewMediaUrl("fixture-review-roots", "video", settings), `${settings.origin}/review-media/sample.mp4`);
  assert.equal(phase2VisualReviewMediaUrl("fixture-review-area", "thumbnail", settings), `${settings.origin}/assets/fixtures/area.png`);
  for (const invalid of [{ ...settings, development: false }, { ...settings, enabled: false }, { ...settings, origin: "https://example.com" }, { ...settings, origin: "http://example.com" }, { ...settings, origin: "http://user:secret@192.168.1.38" }, { ...settings, origin: `${settings.origin}/other` }]) {
    assert.equal(phase2VisualReviewMediaUrl("fixture-review-roots", "video", invalid), null);
  }
  for (const id of [undefined, "actual-stream-id", "fixture-other", "__proto__", "fixture-review-roots/../secret"]) assert.equal(phase2VisualReviewMediaUrl(id, "video", settings), null);
});

test("review seed uses real card contracts, two actual visuals, readable four-item ordering and untouched legacy shape", () => {
  const cards = visualReviewContents("http://127.0.0.1:4183"); assert.equal(cards.length, 4);
  for (const card of cards) assertCardContent(card);
  assert.equal(stepMediaItems(cards[0].steps[0])[0].kind, "activity");
  assert.deepEqual(stepMediaItems(cards[1].intro).map(item => item.kind), ["video", "image", "activity"]);
  assert.deepEqual(stepMediaItems(cards[2].intro).map(item => item.kind), ["image", "activity", "video", "activity"]);
  assert.equal(introductionVideo(cards[2].intro)?.assetId, "fixture-review-area");
  const ids = new Set(cards.flatMap(card => [card.intro, ...card.steps].flatMap(destination => stepMediaItems(destination).flatMap(item => item.kind === "activity" ? [item.activityId] : []))));
  assert.deepEqual([...ids].sort(), ["integration-area", "roots-and-factors"]);
  for (const destination of [cards[3].intro, ...cards[3].steps]) { assert.equal(Object.hasOwn(destination, "mediaItems"), false); assert.equal(destination.mediaItem?.mediaType, "video"); }
});

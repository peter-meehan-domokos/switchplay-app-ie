import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { createMediaReviewHandler, REVIEW_MEDIA_FILENAMES } from "./helpers/mediaReviewFixture";
test("review media fixtures retain distinct assets across authors and repeated reads", () => {
  const fixture = createMediaReviewHandler();
  assert.equal(new Set(REVIEW_MEDIA_FILENAMES).size, 16);
  const hashes: string[] = [];
  for (let i = 0; i < 16; i++) {
    fixture.add(String(i), i);
    const first = fixture.assets.get(String(i))!;
    hashes.push(createHash("sha256").update(first.bytes).digest("hex"));
    assert.equal(fixture.assets.get(String(i)), first);
  }
  assert.equal(new Set(hashes).size, 16);
  assert.deepEqual(REVIEW_MEDIA_FILENAMES.slice(0, 8), ["basketball-hoop.png", "training-cones.png", "balance-board.png", "footwork-ladder.png", "passing-practice.png", "rebound-practice.png", "defensive-positioning.png", "dribbling-practice.png"]);
});

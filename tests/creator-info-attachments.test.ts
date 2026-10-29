import assert from "node:assert/strict";
import { test } from "node:test";
import { requiresPublicInfoAttachments, creatorPublicationErrorMessage } from "../src/components/creator/creatorPublicationPresentation";
import { CreatorRequestError } from "../src/components/creator/creatorRequest";

const lane = (desiredVisibility: "private" | "public", published: "private" | "public" = "private") => ({ desiredVisibility, ack: { root: { visibility: published } } });
for (const deck of ["private", "public"] as const) for (const card of ["private", "public"] as const) {
  test(`${deck} Deck / ${card} Card uses the approved attachment eligibility`, () => {
    assert.equal(requiresPublicInfoAttachments(lane(deck), lane(card)), deck === "public" || card === "public");
  });
}
test("published public permanence overrides a stale private selector on either entity", () => {
  assert.equal(requiresPublicInfoAttachments(lane("private", "public"), lane("private")), true);
  assert.equal(requiresPublicInfoAttachments(lane("private"), lane("private", "public")), true);
});
test("private return intent overrides pending public draft intent, but never public publication", () => {
  const pending = { desiredVisibility: "private" as const, ack: { root: { visibility: "private" as const, draftVisibility: "public" as const } } };
  assert.equal(requiresPublicInfoAttachments(pending, lane("private")), false);
  assert.equal(requiresPublicInfoAttachments({ ack: pending.ack }, lane("private")), true);
});
test("unmaterialised private forks/copies use their resulting lanes, not public source roots", () => {
  const fork = { desiredVisibility: "private" as const, ack: null };
  assert.equal(requiresPublicInfoAttachments(fork, fork), false);
  assert.equal(requiresPublicInfoAttachments(fork, lane("private", "public")), true);
  assert.equal(requiresPublicInfoAttachments({ ...fork, desiredVisibility: "public" }, fork), true);
});
test("publication translation retains structured codes internally without rendering them", () => {
  const error = new CreatorRequestError(400, "PRIVATE_INFO_BLOCKS_PUBLICATION");
  assert.equal(error.code, "PRIVATE_INFO_BLOCKS_PUBLICATION");
  assert.match(creatorPublicationErrorMessage(error), /^Cannot publish publicly\./);
  assert.doesNotMatch(creatorPublicationErrorMessage(error), /PRIVATE_INFO_BLOCKS_PUBLICATION/);
  assert.equal(creatorPublicationErrorMessage(new Error(error.code)), creatorPublicationErrorMessage(error));
  assert.match(creatorPublicationErrorMessage(new Error("PUBLIC_PUBLICATION_REVIEW_CHANGED")), /Review them and confirm again/);
  assert.match(creatorPublicationErrorMessage(new Error("DECK_PUBLICATION_REVIEW_CONFLICT")), /Cards or Deck changed/);
  assert.match(creatorPublicationErrorMessage(new Error("Network unavailable")), /Network unavailable/);
});

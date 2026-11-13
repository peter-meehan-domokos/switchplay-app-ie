import assert from "node:assert/strict";
import test from "node:test";
import { buildInfoCardPublicationLayout, publicationNotice } from "../src/components/info-cards/infoCardPublicationLayout";

// One wording for every interface that resumes a stored Publish or Save (checkpoint 10).
test("pending, confirmation and failure notices name the Info Card and say publish or save", () => {
  const card = { infoCardId: "a", title: " Signs ", kind: "creator" as const };
  assert.deepEqual(publicationNotice({ ...card, status: "pending" }), { infoCardId: "a", tone: "status", message: "Publishing “Signs” when the video is ready." });
  assert.equal(publicationNotice({ ...card, kind: "personal", status: "pending" }).message, "Saving “Signs” when the video is ready.");
  assert.equal(publicationNotice({ ...card, status: "published", version: 2 }).message, "“Signs” has been published.");
  assert.equal(publicationNotice({ ...card, kind: "personal", status: "published", version: 1 }).message, "“Signs” has been saved.");
  assert.deepEqual(publicationNotice({ ...card, status: "failed", code: "INFO_MEDIA_PROCESSING_FAILED" }), { infoCardId: "a", tone: "alert",
    message: "“Signs” was not published: its video could not be processed. Open it to choose another file." });
  assert.equal(publicationNotice({ ...card, kind: "personal", status: "failed", code: "SERIES_FORBIDDEN" }).message, "“Signs” was not saved. Open it to try again.");
  assert.equal(publicationNotice({ ...card, title: "", status: "pending" }).message, "Publishing this Info Card when the video is ready.");
  assert.equal(publicationNotice({ ...card, title: "", status: "published", version: 1 }).message, "This Info Card has been published.");
  assert.deepEqual(buildInfoCardPublicationLayout(undefined), []);
});

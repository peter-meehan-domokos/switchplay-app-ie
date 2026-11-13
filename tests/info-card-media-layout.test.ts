import assert from "node:assert/strict";
import test from "node:test";
import { buildInfoCardMediaLayout, type InfoCardVideoStatus } from "../src/components/info-cards/infoCardMediaLayout";

const none: InfoCardVideoStatus = { state: "", error: "" };
const base = { mediaItem: null, uploading: false, failedFile: false, uploadError: "", videoStatus: none, ready: true };
const image = { mediaType: "image" as const }, video = { mediaType: "video" as const };

test("unavailable until a series and title exist, with no actions", () => {
  assert.deepEqual(buildInfoCardMediaLayout({ ...base, ready: false }), { state: "unavailable", message: "", tone: "none", actions: [] });
});
test("attached media can still be removed when the title or series was cleared, but nothing else", () => {
  const layout = buildInfoCardMediaLayout({ ...base, ready: false, mediaItem: image });
  assert.equal(layout.state, "ready"); assert.deepEqual(layout.actions, ["remove"]);
});
test("empty offers only Choose file", () => {
  const layout = buildInfoCardMediaLayout(base);
  assert.equal(layout.state, "empty"); assert.deepEqual(layout.actions, ["choose"]);
});
test("uploading offers only Cancel, even over existing media or a previous error", () => {
  const layout = buildInfoCardMediaLayout({ ...base, mediaItem: image, uploading: true, uploadError: "old" });
  assert.equal(layout.state, "uploading"); assert.deepEqual(layout.actions, ["cancel"]); assert.match(layout.message, /text keeps saving/);
});
test("a failed upload with a kept file offers Retry, Choose another and Cancel, and shows the readable error", () => {
  const layout = buildInfoCardMediaLayout({ ...base, mediaItem: image, uploadError: "The image transfer failed.", failedFile: true });
  assert.equal(layout.state, "failed-upload"); assert.deepEqual(layout.actions, ["retry", "chooseAnother", "cancel"]);
  assert.equal(layout.message, "The image transfer failed."); assert.equal(layout.tone, "alert");
});
test("a failed upload without a kept file cannot offer Retry", () => {
  assert.deepEqual(buildInfoCardMediaLayout({ ...base, uploadError: "x" }).actions, ["chooseAnother", "cancel"]);
});
test("an image is ready with Replace and Remove", () => {
  const layout = buildInfoCardMediaLayout({ ...base, mediaItem: image });
  assert.equal(layout.state, "ready"); assert.equal(layout.message, "Image attached"); assert.deepEqual(layout.actions, ["replace", "remove"]);
});
test("a video moves through checking, processing with and without progress, then ready", () => {
  const at = (videoStatus: InfoCardVideoStatus) => buildInfoCardMediaLayout({ ...base, mediaItem: video, videoStatus });
  assert.equal(at({ state: "checking", error: "" }).message, "Checking video…");
  assert.equal(at({ state: "processing", error: "" }).message, "Video processing…");
  assert.equal(at({ state: "processing", progress: 41.6, error: "" }).message, "Video processing (42%)");
  assert.equal(at({ state: "processing", progress: 10, error: "" }).state, "processing");
  assert.deepEqual(at({ state: "processing", error: "" }).actions, ["replace", "remove"]);
  const ready = at({ state: "ready", error: "" });
  assert.equal(ready.state, "ready"); assert.equal(ready.message, "Video ready"); assert.deepEqual(ready.actions, ["replace", "remove"]);
});
test("a video that fails processing offers Choose another and Remove", () => {
  const layout = buildInfoCardMediaLayout({ ...base, mediaItem: video, videoStatus: { state: "failed", error: "" } });
  assert.equal(layout.state, "failed-processing"); assert.deepEqual(layout.actions, ["chooseAnother", "remove"]); assert.equal(layout.tone, "alert");
});
test("a status request error is shown in place of the progress message, keeping Replace and Remove", () => {
  const layout = buildInfoCardMediaLayout({ ...base, mediaItem: video, videoStatus: { state: "", error: "The connection failed." } });
  assert.equal(layout.message, "The connection failed."); assert.deepEqual(layout.actions, ["replace", "remove"]);
});
test("transitions: ready, replace, uploading, failed, retry, ready", () => {
  const states = [
    { ...base, mediaItem: image },
    { ...base, mediaItem: image, uploading: true },
    { ...base, mediaItem: image, uploadError: "failed", failedFile: true },
    { ...base, mediaItem: image, uploading: true },
    { ...base, mediaItem: image },
  ].map(input => buildInfoCardMediaLayout(input).state);
  assert.deepEqual(states, ["ready", "uploading", "failed-upload", "uploading", "ready"]);
});
test("removing during processing leaves the empty state", () => {
  assert.equal(buildInfoCardMediaLayout({ ...base, mediaItem: video, videoStatus: { state: "processing", progress: 20, error: "" } }).state, "processing");
  assert.equal(buildInfoCardMediaLayout({ ...base, mediaItem: null, videoStatus: none }).state, "empty");
});
test("the layout does not mutate its input", () => {
  const input = Object.freeze({ ...base, mediaItem: Object.freeze({ mediaType: "video" as const }), videoStatus: Object.freeze({ state: "processing" as const, progress: 5, error: "" }) });
  assert.doesNotThrow(() => buildInfoCardMediaLayout(input));
});

// Checkpoint 10: a Publish or Save stored while the video processes is shown in the same media area.
test("a stored request says it will publish or save when the video is ready, keeping the processing actions", () => {
  const pending = (personal: boolean, videoStatus: InfoCardVideoStatus) => buildInfoCardMediaLayout({ ...base, mediaItem: video, videoStatus, publication: { requested: "pending", personal } });
  assert.deepEqual(pending(false, { state: "processing", progress: 41.6, error: "" }), { state: "processing", tone: "status", actions: ["replace", "remove"],
    message: "Video processing (42%). Publishing when the video is ready." });
  assert.equal(pending(true, { state: "processing", error: "" }).message, "Video processing. Saving when the video is ready.");
  assert.equal(pending(false, { state: "checking", error: "" }).message, "Checking video. Publishing when the video is ready.");
  assert.equal(pending(false, { state: "ready", error: "" }).message, "Video ready. Publishing when the video is ready.");
  // Without a request the wording is unchanged.
  assert.equal(buildInfoCardMediaLayout({ ...base, mediaItem: video, videoStatus: { state: "processing", progress: 10, error: "" }, publication: { requested: null, personal: false } }).message, "Video processing (10%)");
});
test("a failed stored request names what was not published and offers the replacement path", () => {
  const failed = buildInfoCardMediaLayout({ ...base, mediaItem: video, videoStatus: { state: "", error: "" }, publication: { requested: "failed", personal: true } });
  assert.equal(failed.state, "failed-processing"); assert.equal(failed.tone, "alert"); assert.deepEqual(failed.actions, ["chooseAnother", "remove"]);
  assert.equal(failed.message, "The video could not be processed, so the Info Card was not saved. Choose another file or remove it.");
});

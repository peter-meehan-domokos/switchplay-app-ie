import assert from "node:assert/strict";
import test from "node:test";
import { assertCardContent, assertStepMediaWrite } from "../src/lib/cards/domain";
import { createDefaultCardContent, createDefaultDeckContent } from "../src/lib/cards/creatorDefaults";
import { creatorBoard, privateGraph } from "../src/components/creator/cardArchitectureAdapter";
import { creatorBoardToDeckTemplate, createCreatorBoardFromTemplate, isStepEmpty } from "../src/components/creator/creatorBoardState";
import { cardContentPresentation } from "../src/lib/cards/libraryProjection";
import { introductionVideo, instructionalMedia, stepMediaItems, validStepMediaItems, validStepMediaLabel, withStepMedia, type StepMediaItem } from "../src/lib/stepMedia";
import { validateForkAttachments } from "../src/lib/cards/prospectiveUpload";
import type { CloudflareStreamVideoMediaItem } from "../src/lib/media";

const video: CloudflareStreamVideoMediaItem = { id: "video", description: "Video", mediaType: "video", provider: "cloudflare-stream", assetId: "stream", src: "https://iframe.videodelivery.net/stream", width: 720, height: 1280, thumbnailSrc: "https://example.test/poster" };
const mixed: StepMediaItem[] = [
  { id: "image", label: "Image", kind: "image", alt: "Diagram", media: { id: "asset", description: "Diagram", mediaType: "image", provider: "cloudflare-r2", assetId: "image", src: "https://example.test/image.png" } },
  { id: "explore", label: "Explore", kind: "activity", activityId: "integration-area" },
  { id: "watch", label: "Watch", kind: "video", media: video },
  { id: "watch2", label: "Watch 2", kind: "video", media: { ...video, id: "second", assetId: "second" } },
];
const legacy = () => createDefaultCardContent(["one", "two", "three"]);
const modern = () => ({ ...legacy(), intro: withStepMedia(legacy().intro, mixed), steps: legacy().steps.map((step) => withStepMedia(step, mixed)) });

test("legacy projection is deterministic and never converts stored content on read", () => {
  const content = legacy(); content.intro.mediaItem = video;
  delete content.steps[0].mediaItem;
  const before = JSON.stringify(content);
  assert.deepEqual(stepMediaItems(content.intro), [{ id: "legacy:video", label: "Watch", kind: "video", media: video }]);
  assert.equal(introductionVideo(content.intro), video);
  assert.equal(JSON.stringify(content), before);
  assertCardContent(content);
});

test("arrays support zero to four repeated types while first ordered video alone supplies front media", () => {
  assertCardContent(modern());
  assert.equal(introductionVideo({ mediaItems: mixed }), video);
  assert.equal(introductionVideo({ mediaItems: mixed.slice(0, 2) }), null);
  assert.equal(introductionVideo({ mediaItems: [] }), null);
  assert.equal(introductionVideo({ mediaItems: [mixed[3], ...mixed.slice(0, 3)] })?.assetId, "second");
  assert.equal(instructionalMedia(modern()).length, 12);
  assert.equal(validStepMediaItems([]), true);
  assert.equal(validStepMediaItems([mixed[1], { ...mixed[1], id: "same-activity" }]), true);
});

test("strict canonical shape rejects competing representations, invalid IDs and oversized labels", () => {
  for (const mediaItems of [null, [...mixed, { ...mixed[0], id: "fifth" }], [mixed[0], mixed[0]],
    [{ ...mixed[1], activityId: "https://example.test/visual" }], [{ ...mixed[2], media: { ...video, width: -1 } }],
    [{ ...mixed[1], label: "two\nlines" }], [{ ...mixed[1], label: "ABCDEFGHIJKLM" }], [{ ...mixed[1], extra: "field" }]]) {
    assert.equal(validStepMediaItems(mediaItems), false, JSON.stringify(mediaItems));
  }
  assert.equal(validStepMediaLabel("根と因数"), true);
  assert.equal(validStepMediaLabel("Réviser"), true);
  assert.equal(validStepMediaLabel(""), false);
  assert.throws(() => assertCardContent({ ...legacy(), intro: { ...legacy().intro, mediaItems: [] } }), { code: "INVALID_STEP_MEDIA" });
  assert.throws(() => assertCardContent({ ...modern(), steps: [{ ...modern().steps[0], mediaItem: null }, ...modern().steps.slice(1)] }), { code: "INVALID_STEP_MEDIA" });
});

test("old writers cannot introduce arrays or erase modern content using a legacy-shaped write", () => {
  assertStepMediaWrite(undefined, legacy(), legacy());
  assertStepMediaWrite("1", modern(), legacy());
  assertStepMediaWrite("1", legacy(), modern());
  for (const [next, previous] of [[modern(), legacy()], [legacy(), modern()], [modern(), modern()]]) {
    assert.throws(() => assertStepMediaWrite(undefined, next, previous), { code: "STEP_MEDIA_CLIENT_REVISION_REQUIRED" });
    assert.throws(() => assertStepMediaWrite("unsupported", next, previous));
  }
});

test("creator roundtrip retains media arrays, attachment order and legacy field absence", () => {
  for (const content of [legacy(), modern()]) {
    if ("mediaItem" in content.steps[0]) delete content.steps[0].mediaItem;
    const dto = { root: { deckTemplateId: "deck" }, content: { ...createDefaultDeckContent([]), cards: [{ cardTemplateId: "card" }] },
      cards: [{ root: { cardTemplateId: "card" }, content, publishedContent: null }] };
    const board = creatorBoard(dto);
    assert.deepEqual(privateGraph(board, dto).cards[0].content, content);
    if (content.intro.mediaItems) {
      assert.equal(isStepEmpty(Object.values(board.pairs)[0]), false);
      const template = creatorBoardToDeckTemplate(board);
      assert.deepEqual(template.cards[0].intro.mediaItems, mixed);
      assert.deepEqual(createCreatorBoardFromTemplate(template).columns[1].introMediaItems, mixed);
    }
  }
});

test("public projections retain ordered media and strip internal provider fields", () => {
  const content = modern();
  const dirty = content.intro.mediaItems[2];
  if (dirty.kind === "video") Object.assign(dirty.media, { privateToken: "must-not-leak" });
  const result = cardContentPresentation({ cardTemplateId: "card", version: 1, content, publishedAt: new Date(), publishedByUserId: "alice" }, "Card", { username: "alice", immediateSourceUsername: null });
  assert.equal(JSON.stringify(result).includes("must-not-leak"), false);
  assert.equal(Object.hasOwn(result.intro, "mediaItem"), false);
  const firstVideo = introductionVideo(result.intro);
  assert.equal(firstVideo?.provider === "cloudflare-stream" ? firstVideo.width : null, 720);
  if (dirty.kind === "video") delete (dirty.media as typeof video & { privateToken?: string }).privateToken;
});

test("fork proofs inspect nested arrays, preserve trusted source assets and reject unproved replacements", async () => {
  const before = modern(), context = { kind: "card" as const, source: { cardTemplateId: "source", version: 1 }, targetId: "target", context: { kind: "library" as const } };
  await validateForkAttachments("alice", context, before, structuredClone(before));
  const changed = structuredClone(before);
  changed.intro.mediaItems[2] = { id: "replacement", label: "Watch", kind: "video", media: { ...video, assetId: "unproved", src: "https://example.test/unproved" } };
  await assert.rejects(validateForkAttachments("alice", context, before, changed), { code: "INVALID_UPLOAD_ATTACHMENT" });
});

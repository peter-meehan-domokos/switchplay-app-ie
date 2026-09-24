import { expect, test } from "@playwright/test";
import {
  initialMediaUploadControllerState,
  isActiveMediaUploadSession,
  mediaUploadControllerReducer,
  replaceMediaUploadSession,
} from "@/components/media/useMediaUploadController";
import {
  clearSelectedFileInput,
  createImageDirectUploadRequestBody,
  createImageMediaItem,
  createStreamDirectUploadRequestBody,
  createStreamVideoReadinessRequestUrl,
  createStreamVideoMediaItem,
} from "@/lib/mediaUploadClient";
import { deriveCloudflareStreamVideoStatus } from "@/lib/cloudflareStream";
import { streamVideoReadinessPolling } from "@/components/media/useStreamVideoReadiness";

const deckIntroductionTarget = {
  scope: "deck-introduction",
  deckTemplateId: "deck-1",
} as const;

const userCardTarget = {
  scope: "user-card",
  deckTemplateId: "deck-1",
  cardId: "card-3",
} as const;

test("creator image request body remains unchanged", () => {
  expect(createImageDirectUploadRequestBody(deckIntroductionTarget, { type: "image/png" })).toEqual({
    contentType: "image/png",
    deckTemplateId: "deck-1",
  });
});

test("creator video request body remains unchanged", () => {
  expect(createStreamDirectUploadRequestBody(deckIntroductionTarget, { name: "clip.mp4" })).toEqual({
    name: "clip.mp4",
  });
});

test("user-card image request body includes its scoped card target", () => {
  expect(createImageDirectUploadRequestBody(userCardTarget, { type: "image/webp" })).toEqual({
    scope: "user-card",
    deckTemplateId: "deck-1",
    cardId: "card-3",
    contentType: "image/webp",
  });
});

test("user-card video request body includes its scoped card target", () => {
  expect(createStreamDirectUploadRequestBody(userCardTarget, { name: "clip.mp4" })).toEqual({
    scope: "user-card",
    deckTemplateId: "deck-1",
    cardId: "card-3",
    originalFilename: "clip.mp4",
  });
});

test("Stream readiness requests retain the target scope without exposing server credentials", () => {
  expect(createStreamVideoReadinessRequestUrl(deckIntroductionTarget, "intro-video")).toBe(
    "/api/media/stream/status?assetId=intro-video&deckTemplateId=deck-1&scope=deck-introduction",
  );
  expect(createStreamVideoReadinessRequestUrl(userCardTarget, "card-video")).toBe(
    "/api/media/stream/status?assetId=card-video&deckTemplateId=deck-1&scope=user-card&cardId=card-3",
  );
});

test("Cloudflare video details distinguish processing, ready, and permanent failure", () => {
  expect(deriveCloudflareStreamVideoStatus({ success: true, result: { status: { state: "inprogress", pctComplete: 42 } } })).toEqual({
    status: "processing",
    progress: 42,
  });
  expect(deriveCloudflareStreamVideoStatus({ success: true, result: { readyToStream: true, status: { state: "ready" } } })).toEqual({
    status: "ready",
  });
  expect(deriveCloudflareStreamVideoStatus({ success: true, result: { status: { state: "error" } } })).toEqual({
    status: "failed",
  });
});

test("Stream readiness polling has a bounded processing window", () => {
  expect(streamVideoReadinessPolling).toEqual({
    intervalMs: 3_000,
    maxChecks: 40,
  });
});

test("image media construction preserves the server-generated user-card item id", () => {
  expect(createImageMediaItem({
    assetId: "user-decks/user-1/deck-1/cards/card-3/asset.png",
    deliveryUrl: "https://user-uploads.example.com/user-decks/user-1/deck-1/cards/card-3/asset.png",
    mediaItemId: "image-asset",
    uploadURL: "https://signed.example.com/image",
  }, "Photo.png")).toEqual({
    id: "image-asset",
    mediaType: "image",
    provider: "cloudflare-r2",
    assetId: "user-decks/user-1/deck-1/cards/card-3/asset.png",
    src: "https://user-uploads.example.com/user-decks/user-1/deck-1/cards/card-3/asset.png",
    description: "Photo.png",
  });
});

test("creator image media construction retains the derived id behavior", () => {
  const mediaItem = createImageMediaItem({
    assetId: "path-templates/deck-1/introduction/asset.webp",
    deliveryUrl: "https://assets.example.com/path-templates/deck-1/introduction/asset.webp",
    uploadURL: "https://signed.example.com/image",
  }, "Photo.webp");

  expect(mediaItem.id).toBe("image-asset");
});

test("Stream media construction preserves uid, iframe URL and dimensions", () => {
  expect(createStreamVideoMediaItem({
    uid: "stream-uid",
    uploadURL: "https://upload.example.com/video",
    maxDurationSeconds: 150,
  }, "Clip.mp4", { width: 1920, height: 1080 })).toEqual({
    id: "stream-stream-uid",
    mediaType: "video",
    provider: "cloudflare-stream",
    assetId: "stream-uid",
    src: "https://iframe.videodelivery.net/stream-uid",
    description: "Clip.mp4",
    width: 1920,
    height: 1080,
  });
});

test("clearing a file input permits same-file reselection", () => {
  const input = { value: "C:\\fakepath\\photo.png" };

  clearSelectedFileInput(input);

  expect(input.value).toBe("");
});

test("image and video busy and error state remain independent", () => {
  const imageStarted = mediaUploadControllerReducer(initialMediaUploadControllerState, { type: "start", kind: "image" });
  const videoFailed = mediaUploadControllerReducer(imageStarted, { type: "error", kind: "video", message: "Video failed." });

  expect(videoFailed).toEqual({
    imageError: null,
    isImageUploading: true,
    isVideoUploading: false,
    videoUploadStage: "idle",
    videoError: "Video failed.",
  });
});

test("a successful video upload stays busy while its media item is being saved", () => {
  const uploading = mediaUploadControllerReducer(initialMediaUploadControllerState, { type: "start", kind: "video" });
  const saving = mediaUploadControllerReducer(uploading, { type: "saving", kind: "video" });

  expect(saving).toMatchObject({
    isVideoUploading: true,
    videoError: null,
    videoUploadStage: "saving",
  });
});

test("starting a second same-type session aborts the first", () => {
  const firstSession = replaceMediaUploadSession(null, "image");
  replaceMediaUploadSession(firstSession, "image");

  expect(firstSession.controller.signal.aborted).toBe(true);
});

test("a stale upload session is ignored after a newer same-type upload starts", () => {
  const firstSession = replaceMediaUploadSession(null, "image");
  const secondSession = replaceMediaUploadSession(firstSession, "image");

  expect(isActiveMediaUploadSession(secondSession, firstSession)).toBe(false);
  expect(isActiveMediaUploadSession(secondSession, secondSession)).toBe(true);
});

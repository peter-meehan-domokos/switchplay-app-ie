import assert from "node:assert/strict";
import test from "node:test";
import { getDeckIntroductionPosterImage } from "../src/components/decks/deckIntroductionPoster";
import type { DeckIntroduction } from "../src/components/decks/types";
import type { CloudflareR2ImageMediaItem, LegacyProviderlessImageMediaItem, CloudflareStreamVideoMediaItem } from "../src/lib/media";

const legacyImage = {
  id: "legacy-image-1",
  mediaType: "image",
  description: "Legacy image",
  src: "/images/daniel-intro-still.png",
} satisfies LegacyProviderlessImageMediaItem;

const cloudflareImage = {
  id: "image-asset-1",
  mediaType: "image",
  provider: "cloudflare-r2",
  assetId: "asset-1",
  description: "R2 image",
  src: "https://cdn.example.com/images/deck-introductions/asset-1.webp",
} satisfies CloudflareR2ImageMediaItem;

const videoOnlyIntroduction = {
  image: null,
  video: {
    id: "video-1",
    mediaType: "video",
    provider: "cloudflare-stream",
    assetId: "video-asset-1",
    description: "Video",
    src: "https://iframe.videodelivery.net/video-asset-1",
  } satisfies CloudflareStreamVideoMediaItem,
} satisfies DeckIntroduction;

test("null introduction uses the fallback card", () => {
  assert.equal(getDeckIntroductionPosterImage({ introduction: null }), null);
});

test("null image uses the fallback card", () => {
  assert.equal(getDeckIntroductionPosterImage({ introduction: { image: null, video: null } }), null);
});

test("video-only introduction uses the fallback card for now", () => {
  assert.equal(getDeckIntroductionPosterImage({ introduction: videoOnlyIntroduction }), null);
});

test("legacy image renders as the poster", () => {
  assert.deepEqual(getDeckIntroductionPosterImage({ introduction: { image: legacyImage, video: null } }), legacyImage);
});

test("R2 image renders as the poster", () => {
  assert.deepEqual(getDeckIntroductionPosterImage({ introduction: { image: cloudflareImage, video: null } }), cloudflareImage);
});

test("card count does not affect poster selection", () => {
  const posterA = getDeckIntroductionPosterImage({ introduction: { image: legacyImage, video: null } });
  const posterB = getDeckIntroductionPosterImage({ introduction: { image: legacyImage, video: null } });

  assert.deepEqual(posterA, posterB);
});

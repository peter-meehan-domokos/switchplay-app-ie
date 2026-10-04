import assert from "node:assert/strict";
import test from "node:test";
import {
  type CloudflareR2ImageMediaItem,
  type LegacyProviderlessImageMediaItem,
  isCloudflareR2ImageMediaItem,
  isImageMediaItem,
  isLegacyProviderlessImageMediaItem,
} from "../src/lib/media";
import { normalizeDeckIntroductionForRuntime } from "../src/lib/deckApiTransforms";

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

test("legacy providerless image is accepted", () => {
  assert.equal(isImageMediaItem(legacyImage), true);
  assert.equal(isLegacyProviderlessImageMediaItem(legacyImage), true);
  assert.equal(isCloudflareR2ImageMediaItem(legacyImage), false);
});

test("valid R2-backed image is accepted", () => {
  assert.equal(isImageMediaItem(cloudflareImage), true);
  assert.equal(isCloudflareR2ImageMediaItem(cloudflareImage), true);
  assert.equal(isLegacyProviderlessImageMediaItem(cloudflareImage), false);
});

test("R2-backed image missing assetId is rejected", () => {
  assert.equal(
    isImageMediaItem({
      ...cloudflareImage,
      assetId: "",
    }),
    false,
  );
});

test("unknown provider-backed image is rejected", () => {
  assert.equal(
    isImageMediaItem({
      ...cloudflareImage,
      provider: "cloudflare-images",
    }),
    false,
  );
});

test("legacy providerless introduction image remains valid after runtime normalization", () => {
  const introduction = normalizeDeckIntroductionForRuntime({ image: legacyImage, video: null });

  assert.deepEqual(introduction, { image: legacyImage, video: null });
  assert.equal(isImageMediaItem(introduction?.image), true);
  assert.equal(isLegacyProviderlessImageMediaItem(introduction?.image), true);
});

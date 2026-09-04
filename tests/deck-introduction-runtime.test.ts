import assert from "node:assert/strict";
import test from "node:test";
import { mergeDeckTemplatesWithUserData } from "../src/lib/deckData";
import { normalizeDeckTemplateForRuntime } from "../src/lib/deckApiTransforms";
import type { DeckTemplate } from "../src/components/decks/types";
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

const introVideo = {
  id: "video-1",
  mediaType: "video",
  provider: "cloudflare-stream",
  assetId: "video-asset-1",
  description: "Video",
  src: "https://iframe.videodelivery.net/video-asset-1",
} satisfies CloudflareStreamVideoMediaItem;

function buildTemplate(introduction: DeckTemplate["introduction"]) {
  return normalizeDeckTemplateForRuntime({
    deckTemplateId: "deck-introduction-runtime",
    title: "Deck introduction runtime",
    category: null,
    introduction,
    streams: [{ id: "stream-1", title: "Stream 1" }],
    cards: [
      {
        cardId: "card-1",
        label: "Card 1",
        suggestedTargetDate: "",
        intro: { title: "Card 1", description: null, mediaItem: null },
        steps: [{ stepId: "step-1", description: "Step 1", mediaItem: null }],
      },
    ],
  });
}

test("legacy image survives template to runtime propagation", () => {
  const deck = mergeDeckTemplatesWithUserData([buildTemplate({ image: legacyImage, video: null })], [], "user-1")[0];

  assert.deepEqual(deck?.introduction, {
    image: legacyImage,
    video: null,
  });
});

test("R2 image survives template to runtime propagation", () => {
  const deck = mergeDeckTemplatesWithUserData([buildTemplate({ image: cloudflareImage, video: null })], [], "user-1")[0];

  assert.deepEqual(deck?.introduction, {
    image: cloudflareImage,
    video: null,
  });
});

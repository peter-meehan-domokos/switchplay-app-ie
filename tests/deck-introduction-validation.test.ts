import assert from "node:assert/strict";
import test from "node:test";
import { validateDeckTemplateForSave } from "../src/app/api/deck-templates/_lib/templateSaveValidation";
import type { DeckTemplate } from "../src/components/decks/types";
import type { CloudflareR2ImageMediaItem, LegacyProviderlessImageMediaItem, CloudflareStreamVideoMediaItem } from "../src/lib/media";

const baseTemplate = {
  deckTemplateId: "deck-introduction-validation",
  title: "Deck introduction validation",
  category: null,
  streams: [{ id: "stream-1", title: "Stream 1" }],
  cards: [
    {
      cardId: "card-1",
      label: "Card 1",
      suggestedTargetDate: "",
      intro: {
        title: "Card 1",
        description: null,
        mediaItem: null,
      },
      steps: [{ stepId: "step-1", description: "Step 1", mediaItem: null }],
    },
  ],
} satisfies DeckTemplate;

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

function validate(introduction: DeckTemplate["introduction"]) {
  return validateDeckTemplateForSave({
    template: {
      ...baseTemplate,
      introduction,
    },
  });
}

test("introduction accepts legacy image", () => {
  const result = validate({ image: legacyImage, video: null });

  assert.equal(result.ok, true);
});

test("introduction accepts R2 image", () => {
  const result = validate({ image: cloudflareImage, video: null });

  assert.equal(result.ok, true);
});

test("invalid R2 image is rejected", () => {
  const result = validate({
    image: {
      ...cloudflareImage,
      assetId: "",
    },
    video: null,
  });

  assert.equal(result.ok, false);
});

test("video-only introduction remains valid", () => {
  const result = validate({
    image: null,
    video: {
      id: "video-1",
      mediaType: "video",
      provider: "cloudflare-stream",
      assetId: "video-asset-1",
      description: "Video",
      src: "https://iframe.videodelivery.net/video-asset-1",
    } satisfies CloudflareStreamVideoMediaItem,
  });

  assert.equal(result.ok, true);
});

import { expect, test } from "@playwright/test";

import { validateDeckTemplateForSave } from "@/app/api/deck-templates/_lib/templateSaveValidation";
import { normalizeDeckTemplateForRuntime } from "@/lib/deckApiTransforms";
import type { DeckTemplate } from "@/components/decks/types";

const validImage = {
  id: "intro-image",
  description: "Intro image",
  mediaType: "image",
  src: "/images/intro.png",
} as const;

const validVideo = {
  id: "intro-video",
  description: "Intro video",
  mediaType: "video",
  provider: "cloudflare-stream",
  assetId: "stream-asset-id",
  src: "https://customer.cloudflarestream.com/stream-asset-id/manifest/video.m3u8",
} as const;

function createTemplate(overrides: Partial<DeckTemplate> = {}): DeckTemplate {
  return {
    deckTemplateId: "deck-introduction-contract",
    title: "Deck introduction contract",
    category: null,
    streams: [{ id: "stream-1", title: "Stream 1" }],
    cards: [
      {
        cardId: "card-1",
        label: "Card 1",
        suggestedTargetDate: "",
        intro: {
          title: null,
          description: null,
          mediaItem: null,
        },
        steps: [
          {
            stepId: "step-1",
            description: null,
            mediaItem: null,
          },
        ],
      },
    ],
    ...overrides,
  };
}

function validateTemplate(template: unknown) {
  return validateDeckTemplateForSave({ template });
}

test.describe("deck introduction contract", () => {
  test("allows a legacy template with no introduction and normalizes it to null", () => {
    const template = createTemplate();

    const validation = validateTemplate(template);
    const normalizedTemplate = normalizeDeckTemplateForRuntime(template);

    expect(validation.ok).toBe(true);
    expect(validation.ok ? validation.template.introduction : undefined).toBeNull();
    expect(normalizedTemplate.introduction).toBeNull();
  });

  test("normalizes an undefined introduction to null", () => {
    const template = createTemplate({ introduction: undefined });

    expect(normalizeDeckTemplateForRuntime(template).introduction).toBeNull();
  });

  test("allows introduction null", () => {
    const validation = validateTemplate(createTemplate({ introduction: null }));

    expect(validation.ok).toBe(true);
    expect(validation.ok ? validation.template.introduction : undefined).toBeNull();
  });

  test("allows explicit empty introduction media slots", () => {
    const validation = validateTemplate(createTemplate({ introduction: { image: null, video: null } }));

    expect(validation.ok).toBe(true);
    expect(validation.ok ? validation.template.introduction : undefined).toEqual({ image: null, video: null });
  });

  test("allows image-only introduction with explicit video null", () => {
    const validation = validateTemplate(createTemplate({ introduction: { image: validImage, video: null } }));

    expect(validation.ok).toBe(true);
    expect(validation.ok ? validation.template.introduction : undefined).toEqual({ image: validImage, video: null });
  });

  test("allows video-only introduction with explicit image null", () => {
    const validation = validateTemplate(createTemplate({ introduction: { image: null, video: validVideo } }));

    expect(validation.ok).toBe(true);
    expect(validation.ok ? validation.template.introduction : undefined).toEqual({ image: null, video: validVideo });
  });

  test("allows introduction image and video together", () => {
    const validation = validateTemplate(createTemplate({ introduction: { image: validImage, video: validVideo } }));

    expect(validation.ok).toBe(true);
    expect(validation.ok ? validation.template.introduction : undefined).toEqual({
      image: validImage,
      video: validVideo,
    });
  });

  test("rejects an introduction object with a missing image key", () => {
    const validation = validateTemplate(createTemplate({ introduction: { video: validVideo } as DeckTemplate["introduction"] }));

    expect(validation).toEqual({
      ok: false,
      error: "template.introduction.image is required when template.introduction is provided.",
    });
  });

  test("rejects an introduction object with a missing video key", () => {
    const validation = validateTemplate(createTemplate({ introduction: { image: validImage } as DeckTemplate["introduction"] }));

    expect(validation).toEqual({
      ok: false,
      error: "template.introduction.video is required when template.introduction is provided.",
    });
  });

  test("rejects invalid introduction image media", () => {
    const validation = validateTemplate(createTemplate({
      introduction: {
        image: { ...validImage, src: "" },
        video: null,
      } as DeckTemplate["introduction"],
    }));

    expect(validation).toEqual({
      ok: false,
      error: "template.introduction.image must be a valid image media item or null.",
    });
  });

  test("rejects invalid introduction video media", () => {
    const validation = validateTemplate(createTemplate({
      introduction: {
        image: null,
        video: { ...validVideo, assetId: "" },
      } as DeckTemplate["introduction"],
    }));

    expect(validation).toEqual({
      ok: false,
      error: "template.introduction.video must be a valid video media item or null.",
    });
  });
});

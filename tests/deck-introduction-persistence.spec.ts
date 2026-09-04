import { expect, test } from "@playwright/test";

import { validateDeckTemplateForSave } from "@/app/api/deck-templates/_lib/templateSaveValidation";
import type { DeckTemplate, RuntimeDeckTemplate } from "@/components/decks/types";
import type { DeckTemplateDocument, DeckTemplatePreviousVersion } from "@/lib/deckTemplateDocuments";
import { normalizeDeckTemplateForRuntime } from "@/lib/deckApiTransforms";

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
    deckTemplateId: "deck-introduction-persistence",
    title: "Deck introduction persistence",
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

function validateTemplateForPersistence(template: DeckTemplate): RuntimeDeckTemplate {
  const validation = validateDeckTemplateForSave({ template });

  if (!validation.ok) {
    throw new Error(validation.error);
  }

  return validation.template;
}

function createTemplateDocument(template: DeckTemplate): DeckTemplateDocument {
  const validatedTemplate = validateTemplateForPersistence(template);
  const now = new Date("2026-01-01T00:00:00.000Z");
  const publishedTemplate = {
    ...validatedTemplate,
    deckTemplateId: validatedTemplate.deckTemplateId.trim(),
  };

  return {
    deckTemplateId: publishedTemplate.deckTemplateId,
    ownerUserId: "507f1f77bcf86cd799439011",
    visibility: "private",
    template: publishedTemplate,
    savedTemplate: publishedTemplate,
    savedAt: now,
    publishedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

function updatePublishedTemplateDocument(
  document: DeckTemplateDocument,
  nextTemplate: DeckTemplate,
): DeckTemplateDocument {
  const validatedTemplate = validateTemplateForPersistence(nextTemplate);
  const updatedAt = new Date("2026-01-02T00:00:00.000Z");
  const existingPublishedTemplate = normalizeDeckTemplateForRuntime(document.template);
  const updatedTemplate = {
    ...validatedTemplate,
    deckTemplateId: document.deckTemplateId,
  };
  const previousVersions: DeckTemplatePreviousVersion[] = [
    {
      template: existingPublishedTemplate,
      savedAt: updatedAt,
    },
    ...(document.previousVersions ?? []).map((previousVersion) => ({
      ...previousVersion,
      template: normalizeDeckTemplateForRuntime(previousVersion.template),
    })),
  ].slice(0, 3);

  return {
    ...document,
    template: updatedTemplate,
    savedTemplate: updatedTemplate,
    previousVersions,
    savedAt: updatedAt,
    publishedAt: updatedAt,
    updatedAt,
  };
}

function saveDraftTemplateDocument(document: DeckTemplateDocument, nextTemplate: DeckTemplate): DeckTemplateDocument {
  const validatedTemplate = validateTemplateForPersistence(nextTemplate);
  const now = new Date("2026-01-03T00:00:00.000Z");
  const savedTemplate = {
    ...validatedTemplate,
    deckTemplateId: document.deckTemplateId,
  };

  return {
    ...document,
    savedTemplate,
    savedAt: now,
    updatedAt: now,
  };
}

function publishSavedTemplateDocument(document: DeckTemplateDocument): DeckTemplateDocument {
  const publishedAt = new Date("2026-01-04T00:00:00.000Z");
  const existingPublishedTemplate = normalizeDeckTemplateForRuntime(document.template);
  const candidatePublishedTemplate = {
    ...(document.savedTemplate ?? document.template),
    deckTemplateId: document.deckTemplateId,
  };
  const validation = validateDeckTemplateForSave({ template: candidatePublishedTemplate });

  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const publishedTemplate = {
    ...validation.template,
    deckTemplateId: document.deckTemplateId,
  };
  const previousVersions: DeckTemplatePreviousVersion[] = [
    {
      template: existingPublishedTemplate,
      savedAt: publishedAt,
    },
    ...(document.previousVersions ?? []).map((previousVersion) => ({
      ...previousVersion,
      template: normalizeDeckTemplateForRuntime(previousVersion.template),
    })),
  ].slice(0, 3);

  return {
    ...document,
    template: publishedTemplate,
    savedTemplate: publishedTemplate,
    previousVersions,
    savedAt: publishedAt,
    publishedAt,
    updatedAt: publishedAt,
  };
}

function normalizeTemplateDocumentForRuntime(document: DeckTemplateDocument) {
  return {
    ...document,
    template: normalizeDeckTemplateForRuntime(document.template),
    savedTemplate: document.savedTemplate ? normalizeDeckTemplateForRuntime(document.savedTemplate) : undefined,
    previousVersions: (document.previousVersions ?? []).map((previousVersion) => ({
      ...previousVersion,
      template: normalizeDeckTemplateForRuntime(previousVersion.template),
    })),
  };
}

test.describe("deck introduction persistence round trips", () => {
  test("create preserves introduction null", () => {
    const document = createTemplateDocument(createTemplate({ introduction: null }));
    const loadedDocument = normalizeTemplateDocumentForRuntime(document);

    expect(loadedDocument.template.introduction).toBeNull();
    expect(loadedDocument.savedTemplate?.introduction).toBeNull();
  });

  test("create preserves an explicit empty introduction object", () => {
    const document = createTemplateDocument(createTemplate({ introduction: { image: null, video: null } }));
    const loadedDocument = normalizeTemplateDocumentForRuntime(document);

    expect(loadedDocument.template.introduction).toEqual({ image: null, video: null });
    expect(loadedDocument.savedTemplate?.introduction).toEqual({ image: null, video: null });
  });

  test("create preserves image-only introduction", () => {
    const introduction = { image: validImage, video: null };
    const document = createTemplateDocument(createTemplate({ introduction }));
    const loadedDocument = normalizeTemplateDocumentForRuntime(document);

    expect(loadedDocument.template.introduction).toEqual(introduction);
    expect(loadedDocument.savedTemplate?.introduction).toEqual(introduction);
  });

  test("create preserves video-only introduction", () => {
    const introduction = { image: null, video: validVideo };
    const document = createTemplateDocument(createTemplate({ introduction }));
    const loadedDocument = normalizeTemplateDocumentForRuntime(document);

    expect(loadedDocument.template.introduction).toEqual(introduction);
    expect(loadedDocument.savedTemplate?.introduction).toEqual(introduction);
  });

  test("create preserves image and video introduction", () => {
    const introduction = { image: validImage, video: validVideo };
    const document = createTemplateDocument(createTemplate({ introduction }));
    const loadedDocument = normalizeTemplateDocumentForRuntime(document);

    expect(loadedDocument.template.introduction).toEqual(introduction);
    expect(loadedDocument.savedTemplate?.introduction).toEqual(introduction);
  });

  test("update replaces the published and saved introduction", () => {
    const document = createTemplateDocument(createTemplate({ introduction: null }));
    const nextIntroduction = { image: null, video: validVideo };
    const updatedDocument = updatePublishedTemplateDocument(
      document,
      createTemplate({ introduction: nextIntroduction }),
    );
    const loadedDocument = normalizeTemplateDocumentForRuntime(updatedDocument);

    expect(loadedDocument.template.introduction).toEqual(nextIntroduction);
    expect(loadedDocument.savedTemplate?.introduction).toEqual(nextIntroduction);
    expect(loadedDocument.previousVersions[0]?.template.introduction).toBeNull();
  });

  test("draft save preserves introduction without replacing the published template", () => {
    const document = createTemplateDocument(createTemplate({ introduction: null }));
    const draftIntroduction = { image: validImage, video: null };
    const draftDocument = saveDraftTemplateDocument(document, createTemplate({ introduction: draftIntroduction }));
    const loadedDocument = normalizeTemplateDocumentForRuntime(draftDocument);

    expect(loadedDocument.template.introduction).toBeNull();
    expect(loadedDocument.savedTemplate?.introduction).toEqual(draftIntroduction);
  });

  test("publishing a saved draft preserves introduction", () => {
    const document = createTemplateDocument(createTemplate({ introduction: null }));
    const draftIntroduction = { image: validImage, video: validVideo };
    const draftDocument = saveDraftTemplateDocument(document, createTemplate({ introduction: draftIntroduction }));
    const publishedDocument = publishSavedTemplateDocument(draftDocument);
    const loadedDocument = normalizeTemplateDocumentForRuntime(publishedDocument);

    expect(loadedDocument.template.introduction).toEqual(draftIntroduction);
    expect(loadedDocument.savedTemplate?.introduction).toEqual(draftIntroduction);
    expect(loadedDocument.previousVersions[0]?.template.introduction).toBeNull();
  });

  test("legacy stored template with no introduction loads as runtime null", () => {
    const document = createTemplateDocument(createTemplate({ introduction: { image: null, video: null } }));
    const legacyStoredTemplate = { ...document.template };
    delete legacyStoredTemplate.introduction;
    const legacyDocument = {
      ...document,
      template: legacyStoredTemplate,
      savedTemplate: undefined,
    };
    const loadedDocument = normalizeTemplateDocumentForRuntime(legacyDocument);

    expect(loadedDocument.template.introduction).toBeNull();
    expect(loadedDocument.savedTemplate).toBeUndefined();
  });
});

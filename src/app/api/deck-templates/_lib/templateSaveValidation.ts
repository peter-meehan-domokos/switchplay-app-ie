import type { CardTemplateStep, DeckTemplate, StepDescriptionSpan } from "@/components/decks/types";
import {
  isCloudflareStreamVideoMediaItem,
  isImageMediaItem,
  isLegacyProviderlessVideoMediaItem,
  isYouTubeVideoMediaItem,
} from "@/lib/media";
import { normalizeDeckTemplateForRuntime } from "@/lib/deckApiTransforms";

export type TemplateSaveValidationResult =
  | {
      ok: true;
      template: DeckTemplate;
    }
  | {
      ok: false;
      error: string;
    };

export function hasNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringOrNull(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

function normalizeHttpUrlForSave(value: string) {
  try {
    const url = new URL(value.trim());

    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function validateStepDescriptionContentForSave(value: unknown): { ok: true; content?: StepDescriptionSpan[] } | { ok: false; error: string } {
  if (value === undefined) {
    return { ok: true };
  }

  if (!Array.isArray(value)) {
    return { ok: false, error: "step.descriptionContent must be an array when provided." };
  }

  const content: StepDescriptionSpan[] = [];

  for (const span of value) {
    if (!isPlainObject(span)) {
      return { ok: false, error: "Each step description span must be an object." };
    }

    if (span.type === "text") {
      if (typeof span.text !== "string") {
        return { ok: false, error: "Step description text spans must include text." };
      }

      if (span.text !== "") {
        content.push({ type: "text", text: span.text });
      }
      continue;
    }

    if (span.type === "link") {
      if (typeof span.text !== "string" || typeof span.url !== "string" || span.text.trim() === "") {
        return { ok: false, error: "Step description link spans must include non-empty text and url." };
      }

      const url = normalizeHttpUrlForSave(span.url);

      if (!url) {
        return { ok: false, error: "Step description link URLs must use http or https." };
      }

      content.push({ type: "link", text: span.text, url });
      continue;
    }

    return { ok: false, error: "Step description span type must be text or link." };
  }

  return content.length > 0 ? { ok: true, content } : { ok: true };
}

function normalizeStepDescriptionContentForSave(step: CardTemplateStep): CardTemplateStep {
  const { descriptionContent: _descriptionContent, ...stepWithoutDescriptionContent } = step;
  const validation = validateStepDescriptionContentForSave(step.descriptionContent);

  if (!validation.ok || !validation.content) {
    return stepWithoutDescriptionContent;
  }

  return {
    ...stepWithoutDescriptionContent,
    descriptionContent: validation.content,
  };
}

function validateMediaItemForSave(mediaItem: unknown, fieldPath: string): string | null {
  if (mediaItem === undefined || mediaItem === null) {
    return null;
  }

  if (!isPlainObject(mediaItem)) {
    return `${fieldPath} must be an object or null.`;
  }

  if (isImageMediaItem(mediaItem) || isCloudflareStreamVideoMediaItem(mediaItem) || isYouTubeVideoMediaItem(mediaItem)) {
    return null;
  }

  // Compatibility only: older persisted data may contain providerless video media.
  if (isLegacyProviderlessVideoMediaItem(mediaItem)) {
    return null;
  }

  if (mediaItem.mediaType === "image") {
    return `${fieldPath} image media must include non-empty id, description, and src.`;
  }

  if (mediaItem.mediaType === "video") {
    return `${fieldPath} video media must include provider, non-empty id, description, src, and assetId.`;
  }

  return `${fieldPath}.mediaType must be image or video.`;
}

export function validateDeckTemplateForSave(body: unknown): TemplateSaveValidationResult {
  if (!isPlainObject(body)) {
    return { ok: false, error: "Invalid request body." };
  }

  const template = body.template;

  if (!isPlainObject(template)) {
    return { ok: false, error: "template is required." };
  }

  if (!hasNonEmptyString(template.deckTemplateId)) {
    return { ok: false, error: "template.deckTemplateId is required." };
  }

  if (!hasNonEmptyString(template.title)) {
    return { ok: false, error: "template.title is required." };
  }

  if (!isStringOrNull(template.category)) {
    return { ok: false, error: "template.category must be a string or null." };
  }

  const streams = Array.isArray(template.streams) ? template.streams : template.channels;

  if (!Array.isArray(streams)) {
    return { ok: false, error: "template.streams must be an array." };
  }

  for (const stream of streams) {
    if (!isPlainObject(stream) || !hasNonEmptyString(stream.id)) {
      return { ok: false, error: "Each stream must have an id." };
    }
  }

  if (!Array.isArray(template.cards)) {
    return { ok: false, error: "template.cards must be an array." };
  }

  for (const card of template.cards) {
    if (!isPlainObject(card) || !hasNonEmptyString(card.cardId)) {
      return { ok: false, error: "Each card must have a cardId." };
    }

    if (!Array.isArray(card.steps)) {
      return { ok: false, error: "Each card must have a steps array." };
    }

    if (isPlainObject(card.intro)) {
      const introMediaError = validateMediaItemForSave(card.intro.mediaItem, "card.intro.mediaItem");

      if (introMediaError) {
        return { ok: false, error: introMediaError };
      }
    }

    for (const step of card.steps) {
      if (!isPlainObject(step) || !hasNonEmptyString(step.stepId)) {
        return { ok: false, error: "Each step must have a stepId." };
      }

      const stepMediaError = validateMediaItemForSave(step.mediaItem, "step.mediaItem");

      if (stepMediaError) {
        return { ok: false, error: stepMediaError };
      }

      const stepDescriptionContentValidation = validateStepDescriptionContentForSave(step.descriptionContent);

      if (!stepDescriptionContentValidation.ok) {
        return { ok: false, error: stepDescriptionContentValidation.error };
      }
    }

    if (card.signals !== undefined && !Array.isArray(card.signals)) {
      return { ok: false, error: "card.signals must be an array when provided." };
    }

    for (const signal of card.signals ?? []) {
      if (!isPlainObject(signal) || !hasNonEmptyString(signal.signalId)) {
        return { ok: false, error: "Each signal must have a signalId." };
      }
    }
  }

  const normalizedTemplate = normalizeDeckTemplateForRuntime(template as Parameters<typeof normalizeDeckTemplateForRuntime>[0]);

  return {
    ok: true,
    template: {
      ...normalizedTemplate,
      cards: normalizedTemplate.cards.map((card) => ({
        ...card,
        steps: card.steps.map(normalizeStepDescriptionContentForSave),
      })),
    },
  };
}

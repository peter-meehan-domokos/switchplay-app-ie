import type { DeckTemplate } from "@/components/decks/types";
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

  return {
    ok: true,
    template: normalizeDeckTemplateForRuntime(template as Parameters<typeof normalizeDeckTemplateForRuntime>[0]),
  };
}

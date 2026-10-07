import { isIsoDateOnlyString } from "../dateOnly";
import { isImageMediaItem, isVideoMediaItem } from "../media";
import type { AdoptedVersion, CardContent, CardData, CardTemplateRoot, DeckContent, DeckTemplateRoot, Step } from "./model";

export class CardArchitectureError extends Error {
  constructor(public code: string, message: string = code) { super(message); this.name = "CardArchitectureError"; }
}
export function requireCondition(value: unknown, code: string): asserts value {
  if (!value) throw new CardArchitectureError(code);
}
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date);
}
export function nonblank(value: unknown): value is string { return typeof value === "string" && value.trim() !== ""; }
export function assertAdoption(value: unknown): asserts value is AdoptedVersion {
  requireCondition(typeof value === "number" && Number.isInteger(value) && value >= 1, "INVALID_ADOPTED_VERSION");
}
function keys(value: Record<string, unknown>, allowed: string[]) {
  requireCondition(Object.keys(value).every((key) => allowed.includes(key)), "UNSUPPORTED_CONTENT_FIELD");
}
function text(value: unknown, nullable = false) { requireCondition(typeof value === "string" || (nullable && value === null), "INVALID_CONTENT_TEXT"); }
function media(value: unknown) { requireCondition(value == null || isImageMediaItem(value) || isVideoMediaItem(value), "INVALID_CANONICAL_MEDIA"); }
export function assertCardContent(value: unknown): asserts value is CardContent {
  requireCondition(isRecord(value), "INVALID_CARD_CONTENT"); keys(value, ["intro", "steps", "suggestedTargetDate", "mediaItem"]);
  media(value.mediaItem);
  requireCondition(isRecord(value.intro), "INVALID_CARD_INTRO"); keys(value.intro, ["title", "description", "mediaItem"]);
  requireCondition(Object.hasOwn(value.intro, "mediaItem") && value.intro.mediaItem !== undefined, "INVALID_CARD_INTRO");
  text(value.intro.title, true); text(value.intro.description, true); media(value.intro.mediaItem);
  requireCondition(value.suggestedTargetDate === "" || isIsoDateOnlyString(value.suggestedTargetDate), "INVALID_SUGGESTED_DATE");
  requireCondition(Array.isArray(value.steps) && value.steps.length === 3, "CARD_REQUIRES_THREE_STEPS");
  const ids = new Set();
  for (const step of value.steps) {
    requireCondition(isRecord(step) && nonblank(step.stepId), "INVALID_STEP");
    keys(step, ["stepId", "title", "description", "descriptionContent", "mediaItem", "forkedFrom"]);
    if (step.forkedFrom !== undefined) {
      requireCondition(isRecord(step.forkedFrom) && nonblank(step.forkedFrom.cardTemplateId)
        && nonblank(step.forkedFrom.stepId) && Number.isInteger(step.forkedFrom.version) && Number(step.forkedFrom.version) >= 1, "INVALID_STEP_LINEAGE");
      keys(step.forkedFrom, ["cardTemplateId", "version", "stepId"]);
    }
    requireCondition(!ids.has(step.stepId), "DUPLICATE_STEP_ID"); ids.add(step.stepId);
    if (step.title !== undefined) text(step.title);
    text(step.description, true); media(step.mediaItem);
    if (step.descriptionContent !== undefined) {
      requireCondition(Array.isArray(step.descriptionContent), "INVALID_RICH_TEXT");
      for (const span of step.descriptionContent) {
        requireCondition(isRecord(span) && ["text", "link"].includes(String(span.type)) && typeof span.text === "string", "INVALID_RICH_TEXT");
        keys(span, span.type === "link" ? ["type", "text", "url"] : ["type", "text"]);
        if (span.type === "link") requireCondition(nonblank(span.url), "INVALID_RICH_TEXT");
      }
    }
  }
}
export function assertDeckContent(value: unknown): asserts value is DeckContent {
  requireCondition(isRecord(value), "INVALID_DECK_CONTENT");
  keys(value, ["title", "introduction", "categories", "themes", "cadence", "labelPrefix", "cards"]);
  text(value.title); requireCondition(nonblank(value.labelPrefix), "INVALID_LABEL_PREFIX");
  requireCondition(Array.isArray(value.categories) && value.categories.every(nonblank), "INVALID_CATEGORIES");
  requireCondition(Array.isArray(value.themes), "INVALID_THEMES");
  const themes = new Set();
  for (const theme of value.themes) {
    requireCondition(isRecord(theme) && nonblank(theme.id) && typeof theme.title === "string" && !themes.has(theme.id), "INVALID_THEME");
    keys(theme, ["id", "title"]); themes.add(theme.id);
  }
  requireCondition(isRecord(value.cadence) && Number.isInteger(value.cadence.intervalDays) && Number(value.cadence.intervalDays) > 0, "INVALID_CADENCE");
  keys(value.cadence, ["intervalDays"]);
  requireCondition(value.introduction === null || isRecord(value.introduction), "INVALID_DECK_INTRODUCTION");
  if (isRecord(value.introduction)) { keys(value.introduction, ["image", "video"]); media(value.introduction.image); media(value.introduction.video); }
  requireCondition(Array.isArray(value.cards), "INVALID_CARD_REFERENCES");
  const cards = new Set();
  for (const ref of value.cards) {
    requireCondition(isRecord(ref) && nonblank(ref.cardTemplateId) && !cards.has(ref.cardTemplateId), "DUPLICATE_OR_INVALID_CARD_REFERENCE");
    keys(ref, ["cardTemplateId"]); cards.add(ref.cardTemplateId);
  }
}
export function initialTargetDate(existingDate: string | null, suggestedDate: string, generatedDate: string | null): string | null {
  requireCondition(existingDate === null || isIsoDateOnlyString(existingDate), "INVALID_TARGET_DATE");
  requireCondition(suggestedDate === "" || isIsoDateOnlyString(suggestedDate), "INVALID_SUGGESTED_DATE");
  requireCondition(generatedDate === null || isIsoDateOnlyString(generatedDate), "INVALID_TARGET_DATE");
  return existingDate ?? (suggestedDate || generatedDate);
}
export function initialCardData(cardTemplateId: string, version: AdoptedVersion, content: CardContent, now: Date, generatedTargetDate: string | null = null): CardData {
  assertAdoption(version); assertCardContent(content);
  return { cardTemplateId, cardTemplateVersion: version, targetDate: initialTargetDate(null, content.suggestedTargetDate, generatedTargetDate),
    items: content.steps.map(({ stepId }) => ({ stepId, completionStatus: "todo" })),
    signalReadings: content.steps.map(({ stepId }) => ({ stepId, reading: null })),
    reflection: "", mediaItems: [], chats: [], tests: [], createdAt: now, updatedAt: now };
}
export function createStep(description: string | null = null): Step { return { stepId: globalThis.crypto.randomUUID(), description, mediaItem: null }; }
export function stepLinkedSignals(content: CardContent, data: CardData) {
  const readings = new Map(data.signalReadings.map((reading) => [reading.stepId, reading.reading]));
  return content.steps.map((step) => ({ stepId: step.stepId, title: step.title ?? "", reading: readings.get(step.stepId) ?? null }));
}
export function cardConfidence(content: CardContent, data: CardData): number | null {
  const readings = stepLinkedSignals(content, data).map((signal) => signal.reading).filter((value): value is number => value !== null && Number.isFinite(value) && value >= 1 && value <= 10);
  return readings.length ? Math.round(readings.reduce((sum, value) => sum + value, 0) / readings.length) : null;
}
export function reorderSteps(content: CardContent, from: number, to: number): CardContent {
  assertCardContent(content); requireCondition([from, to].every((i) => Number.isInteger(i) && i >= 0 && i < content.steps.length), "INVALID_STEP_POSITION");
  const steps = [...content.steps]; const [step] = steps.splice(from, 1); steps.splice(to, 0, step); return { ...content, steps };
}
// Three fixed slots: cross-Card dragging swaps their embedded Step content/identity.
export function swapConstructionSteps(source: CardTemplateRoot, destination: CardTemplateRoot, deck: DeckTemplateRoot, sourceIndex: number, destinationIndex: number) {
  requireCondition(!source.firstReusedAt && !destination.firstReusedAt, "CROSS_CARD_MOVE_AFTER_REUSE");
  requireCondition(source.cardTemplateId !== destination.cardTemplateId, "CROSS_CARD_REQUIRES_TWO_CARDS");
  requireCondition([source, destination, deck].every((root) => root.latestVersion === 0 && root.forkedFrom === null), "CROSS_CARD_MOVE_AFTER_PUBLICATION");
  requireCondition(source.draft !== null && destination.draft !== null, "MISSING_DRAFT");
  assertCardContent(source.draft); assertCardContent(destination.draft);
  requireCondition(Number.isInteger(sourceIndex) && sourceIndex >= 0 && sourceIndex < source.draft!.steps.length && Number.isInteger(destinationIndex) && destinationIndex >= 0 && destinationIndex < destination.draft!.steps.length, "INVALID_STEP_POSITION");
  const a = structuredClone(source.draft); const b = structuredClone(destination.draft);
  [a.steps[sourceIndex], b.steps[destinationIndex]] = [b.steps[destinationIndex], a.steps[sourceIndex]];
  return { source: a, destination: b };
}

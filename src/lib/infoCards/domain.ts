import { isRecord, requireCondition } from "../cards/domain";
import { isCloudflareR2ImageMediaItem, isCloudflareStreamVideoMediaItem } from "../media";
import type { InfoDraft } from "./model";
import type { Visibility } from "../cards/model";

export function infoId(value: unknown): asserts value is string {
  requireCondition(typeof value === "string" && value.length > 0 && value.length <= 200 && !/[^a-zA-Z0-9_-]/.test(value), "INVALID_INFO_ID");
}
export function revision(value: unknown): asserts value is number {
  requireCondition(Number.isSafeInteger(value) && Number(value) >= 0, "INVALID_INFO_REVISION");
}
export function visibility(value: unknown): asserts value is Visibility {
  requireCondition(value === "private" || value === "public", "INVALID_INFO_VISIBILITY");
}
export function assertInfoDraft(value: unknown): asserts value is InfoDraft {
  requireCondition(isRecord(value) && Object.keys(value).every(k => ["title", "body", "seriesId", "mediaItem", "bodyFormat"].includes(k)), "INVALID_INFO_DRAFT");
  requireCondition(value.bodyFormat === undefined || value.bodyFormat === "latex-v1", "INVALID_INFO_FORMAT");
  // Transport/storage ceiling only; publication capacity is measured separately.
  requireCondition(typeof value.title === "string" && value.title.length <= 10000 && typeof value.body === "string" && value.body.length <= 100000, "INVALID_INFO_TEXT");
  if (value.seriesId !== null) infoId(value.seriesId);
  const item = value.mediaItem;
  requireCondition(item === null || isCloudflareR2ImageMediaItem(item) || isCloudflareStreamVideoMediaItem(item), "INVALID_INFO_MEDIA");
  if (isRecord(item)) requireCondition(Object.keys(item).every(k => ["id", "description", "mediaType", "provider", "assetId", "src", "width", "height"].includes(k))
    && JSON.stringify(item).length <= 8192, "INVALID_INFO_MEDIA");
}
export function seriesName(value: unknown) {
  requireCondition(typeof value === "string" && value.length <= 10000, "INVALID_SERIES_TITLE");
  const title = value.normalize("NFKC").trim().replace(/\s+/gu, " ");
  requireCondition(title.length > 0 && !/[\p{Cc}\p{Cf}]/u.test(title), "INVALID_SERIES_TITLE");
  return { title, normalisedTitle: title.toLowerCase() };
}
// Phase 4 must apply this at every main-content boundary, including comparison.
export function infoReferences(value: unknown): string[] {
  if (value === undefined) return [];
  requireCondition(Array.isArray(value), "INVALID_INFO_REFERENCES");
  value.forEach(infoId);
  requireCondition(new Set(value).size === value.length, "DUPLICATE_INFO_REFERENCE");
  return [...value];
}
export function sameInfoReferences(a: unknown, b: unknown) {
  const left = infoReferences(a), right = infoReferences(b);
  return left.length === right.length && left.every((id, i) => id === right[i]);
}

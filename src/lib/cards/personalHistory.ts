import { isRecord, nonblank } from "./domain";
import { isIsoDateOnlyString } from "../dateOnly";
import { isMediaItem, type MediaItem } from "../media";
import type { CardData } from "./model";
import { infoReferences } from "../infoCards/domain";

// Read-boundary repair only: never rewrite stored events or relax new-upload
// validation. A bad item/comment cannot invalidate other items or current state.
function validItems<T extends { id: string }>(value: unknown, parse: (value: unknown) => T | null): T[] {
  if (!Array.isArray(value)) return [];
  const result: T[] = [], seen = new Set<string>();
  for (const raw of value) {
    const item = parse(raw);
    if (!item) continue;
    const id = item.id;
    if (seen.has(id)) continue;
    seen.add(id); result.push(item);
  }
  return result;
}
export function readablePersonalHistory(data: CardData) {
  const tests = validItems<CardData["tests"][number]>(data.tests, (value) => {
    if (!isRecord(value) || !nonblank(value.id) || !isIsoDateOnlyString(value.date) || typeof value.result !== "boolean") return null;
    const createdAt = value.createdAt instanceof Date ? value.createdAt
      : typeof value.createdAt === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value.createdAt) ? new Date(value.createdAt) : null;
    if (!createdAt || !Number.isFinite(createdAt.getTime())) return null;
    return { id: value.id, date: value.date, result: value.result, createdAt };
  });
  const chats = validItems<CardData["chats"][number]>(data.chats, (value) => {
    if (!isRecord(value) || !nonblank(value.id) || !nonblank(value.deckTemplateId)) return null;
    const comments = validItems<CardData["chats"][number]["comments"][number]>(value.comments, (comment) => {
      if (!isRecord(comment) || !nonblank(comment.id) || !nonblank(comment.creatorId)
        || typeof comment.text !== "string" || typeof comment.isRetained !== "boolean"
        || typeof comment.createdAt !== "string" || !Number.isFinite(Date.parse(comment.createdAt))) return null;
      return { id: comment.id, creatorId: comment.creatorId, text: comment.text, isRetained: comment.isRetained, createdAt: comment.createdAt };
    });
    return { id: value.id, deckTemplateId: value.deckTemplateId, comments };
  });
  const mediaItems = validItems<CardData["mediaItems"][number]>(data.mediaItems, (value) => {
    if (!isMediaItem(value)) return null;
    // These are projection metadata, never trusted attributes of a stored upload.
    const { sourceCardTemplateId, historyReadOnly, ...item } = value as MediaItem & { sourceCardTemplateId?: unknown; historyReadOnly?: unknown };
    void sourceCardTemplateId; void historyReadOnly;
    return item;
  });
  let personalInfoCardIds: string[] = [];
  try { personalInfoCardIds = infoReferences(data.personalInfoCardIds); } catch { /* Corrupt list is not an ancestry grant. */ }
  const personalInfoCardAttachedAt = Object.fromEntries(personalInfoCardIds.flatMap(id => {
    const value = data.personalInfoCardAttachedAt?.[id];
    const date = value instanceof Date ? value : typeof value === "string" ? new Date(value) : null;
    return date && Number.isFinite(date.getTime()) ? [[id, date.toISOString()]] : [];
  }));
  return { tests, chats, mediaItems, ...(data.personalInfoCardIds !== undefined || data.personalInfoRevision !== undefined ? {
    personalInfoCardIds, personalInfoCardAttachedAt,
    personalInfoRevision: Number.isSafeInteger(data.personalInfoRevision) && data.personalInfoRevision! >= 0 ? data.personalInfoRevision! : 0 } : {}) };
}

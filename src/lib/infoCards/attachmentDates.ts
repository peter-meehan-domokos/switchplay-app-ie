import type { CardContent } from "../cards/model";
import { isRecord, requireCondition } from "../cards/domain";
import { infoReferences } from "./domain";

export function assertAttachmentDates(ids: unknown, value: unknown): asserts value is Record<string, string> | undefined {
  const allowed = infoReferences(ids);
  if (value === undefined) return;
  requireCondition(isRecord(value) && Object.entries(value).every(([id, date]) => allowed.includes(id)
    && !["__proto__", "constructor", "prototype"].includes(id)
    && typeof date === "string" && Number.isFinite(Date.parse(date)) && new Date(date).toISOString() === date), "INVALID_INFO_ATTACHMENT_DATES");
}

// Client timestamps are transport metadata, never authority. Missing retained
// dates stay missing (legacy fallback on reads); only real additions get now.
export function withInfoAttachmentDates(content: CardContent, previous?: CardContent | null, now = new Date()): CardContent {
  const previousIds = infoReferences(previous?.infoCardIds);
  const dates: Record<string, string> = {};
  for (const id of infoReferences(content.infoCardIds)) {
    if (previousIds.includes(id)) {
      const date = previous?.infoCardAttachedAt?.[id];
      if (date) dates[id] = date;
    } else dates[id] = now.toISOString();
  }
  const { infoCardAttachedAt: ignored, ...rest } = content; void ignored;
  return Object.keys(dates).length ? { ...rest, infoCardAttachedAt: dates } : rest;
}

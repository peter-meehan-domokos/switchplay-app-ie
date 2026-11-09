import { createHash } from "node:crypto";
import { requireCondition } from "../cards/domain";
import { hash } from "./contracts";
import type { PreparationAuthority, PreparationPage, PreparationPart } from "./preparationPages";
export const PREPARATION_PAGE_BYTES = 2_500_000; // Headroom below the existing hosted response limit, not a content cap.
type Cursor = { scope: string; index: number; offset: number; digest?: string };
export function preparationCursor(value?: string): Cursor | undefined {
  if (!value) return;
  requireCondition(value.length < 2000, "INVALID_GROUP_PAGE");
  let row: Cursor;
  try { row = JSON.parse(Buffer.from(value, "base64url").toString()); } catch { requireCondition(false, "INVALID_GROUP_PAGE"); }
  requireCondition(typeof row!.scope === "string" && Number.isSafeInteger(row!.index) && row!.index >= 0 && Number.isSafeInteger(row!.offset) && row!.offset >= 0
    && (!row!.offset || typeof row!.digest === "string"), "INVALID_GROUP_PAGE");
  return row!;
}
export function packPreparation(authority: PreparationAuthority, context: unknown, entries: { index: number; value: unknown }[], total: number,
  after?: string, selection?: PreparationPage["selection"], budget = PREPARATION_PAGE_BYTES): PreparationPage {
  const scope = hash([authority, context]), cursor = preparationCursor(after);
  requireCondition(!cursor || cursor.scope === scope, "GROUP_SCOPE_CONFLICT");
  let index = cursor?.index ?? 0, offset = cursor?.offset ?? 0;
  const page: PreparationPage = { ...authority, paged: true, scope, parts: [], next: null, ...(selection ? { selection } : {}) };
  const bytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value));
  let remaining = budget - bytes(page) - 700; // Include the longest cursor and JSON punctuation.
  requireCondition(remaining > 0, "INVALID_GROUP_PAGE");
  for (const entry of entries) {
    if (entry.index < index) continue;
    requireCondition(entry.index === index && index < total, "INVALID_GROUP_PAGE");
    const full: PreparationPart = { index, value: entry.value }, size = bytes(full);
    if (!offset && size <= remaining) { page.parts.push(full); remaining -= size + 1; index++; continue; }
    if (!offset && page.parts.length) break;
    const text = JSON.stringify(entry.value), digest = createHash("sha256").update(text).digest("hex");
    // Only a fragmented logical item needs exact mutable-content continuity.
    // Other complete items/pages may represent ordinary independent updates.
    requireCondition(!offset || cursor?.digest === digest, "GROUP_PREPARATION_CONTENT_CHANGED");
    requireCondition(offset < text.length, "INVALID_GROUP_PAGE");
    let low = 1, high = text.length - offset, fit = 0;
    while (low <= high) {
      const n = Math.floor((low + high) / 2), part = { index, text: text.slice(offset, offset + n), offset, digest, last: offset + n === text.length };
      if (bytes(part) <= remaining) { fit = n; low = n + 1; } else high = n - 1;
    }
    requireCondition(fit > 0, "INVALID_GROUP_PAGE");
    const last = offset + fit === text.length;
    page.parts.push({ index, text: text.slice(offset, offset + fit), offset, digest, last });
    if (last) { index++; offset = 0; } else offset += fit;
    page.next = index < total ? Buffer.from(JSON.stringify({ scope, index, offset, ...(offset ? { digest } : {}) })).toString("base64url") : null;
    return page;
  }
  page.next = index < total ? Buffer.from(JSON.stringify({ scope, index, offset })).toString("base64url") : null;
  return page;
}

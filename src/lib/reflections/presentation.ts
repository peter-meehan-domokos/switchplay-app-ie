import { reflectionSlotKey, type ReflectionContext, type ReflectionDisplayItem, type ReflectionEntry } from "./model";

function requireEntry(entry: ReflectionEntry) {
  if (typeof entry.text !== "string" || !Number.isSafeInteger(entry.revision) || entry.revision < 0
    || (entry.createdAt !== null && !Number.isFinite(Date.parse(entry.createdAt)))) throw Error("Invalid reflection entry.");
}
function compare(a: ReflectionEntry, b: ReflectionEntry) {
  const dateA = a.createdAt === null ? -Infinity : Date.parse(a.createdAt);
  const dateB = b.createdAt === null ? -Infinity : Date.parse(b.createdAt);
  if (dateA !== dateB) return dateA > dateB ? -1 : 1;
  const keyA = reflectionSlotKey(a), keyB = reflectionSlotKey(b);
  return keyA < keyB ? -1 : keyA > keyB ? 1 : 0;
}
function distinct(entries: ReflectionEntry[]) {
  const keys = new Set<string>();
  for (const entry of entries) {
    requireEntry(entry); const key = reflectionSlotKey(entry);
    if (keys.has(key)) throw Error("Duplicate reflection source."); keys.add(key);
  }
}

// currentSlot is explicitly supplied by its authorised source reader. An empty
// slot is a virtual display item, never a database insertion or another source.
export function ownReflectionItems(context: ReflectionContext, currentSlot: ReflectionEntry, history: ReflectionEntry[]): ReflectionDisplayItem[] {
  const expectedKind = context.kind === "personal" ? "personal" : "group";
  if (currentSlot.source.kind !== expectedKind || currentSlot.authorUserId !== context.viewerUserId
    || currentSlot.source.cardTemplateId !== context.cardTemplateId
    || (context.kind === "group" && (currentSlot.source.kind !== "group" || currentSlot.source.experienceId !== context.experienceId))) throw Error("Invalid current reflection slot.");
  requireEntry(currentSlot);
  const currentKey = reflectionSlotKey(currentSlot);
  for (const entry of history) {
    if (entry.authorUserId !== context.viewerUserId || entry.source.cardTemplateId !== context.cardTemplateId) throw Error("Invalid owner reflection history.");
    requireEntry(entry);
  }
  const secondary = history.filter(entry => reflectionSlotKey(entry) !== currentKey && entry.text.trim().length > 0);
  distinct(secondary);
  const entries = [currentSlot, ...secondary.sort(compare)];
  return entries.map(entry => ({ entry, empty: entry.text.trim().length === 0,
    label: entries.length === 1 && entry.source.kind === "personal" ? null : entry.originName,
    private: context.kind === "group" && (entry.source.kind !== "group" || entry.source.experienceId !== context.experienceId || !entry.groupVisible) }));
}

// This validates an already-authorised narrow server feed. It is deliberately
// not a substitute for querying foreign shared text only at the DB boundary.
export function sharedReflectionItems(context: Extract<ReflectionContext, { kind: "group" }>, entries: ReflectionEntry[], subjectUserId?: string): ReflectionDisplayItem[] {
  distinct(entries);
  for (const entry of entries) {
    if (entry.source.kind !== "group" || entry.source.experienceId !== context.experienceId || entry.source.cardTemplateId !== context.cardTemplateId
      || !entry.groupVisible || !entry.text.trim() || (subjectUserId !== undefined && entry.authorUserId !== subjectUserId)) throw Error("Invalid shared reflection history.");
  }
  return [...entries].sort(compare).map(entry => ({ entry, empty: false, private: false,
    label: subjectUserId === undefined ? entry.authorName : entry.originName }));
}

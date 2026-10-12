export type ProgressReturn = { frameworkId: string; areaId?: string; restored?: boolean };
const valid = (value: string | null): value is string => !!value && value.trim() === value && value.length <= 200 && !/[\x00-\x1f]/.test(value);
export function readProgressReturn(query: { get(key: string): string | null }): ProgressReturn | null {
  const frameworkId = query.get("progressFramework"), areaId = query.get("progressArea");
  if (!valid(frameworkId) || (areaId !== null && !valid(areaId))) return null;
  return { frameworkId, ...(areaId ? { areaId } : {}), ...(query.get("progressRestored") === "1" ? { restored: true } : {}) };
}
export function withProgressReturn(href: string, context: ProgressReturn | null) {
  if (!context) return href;
  const url = new URL(href, "http://switchplay.local");
  if (url.origin !== "http://switchplay.local" || url.pathname !== "/decks") return href;
  url.searchParams.set("progressFramework", context.frameworkId);
  if (context.areaId) url.searchParams.set("progressArea", context.areaId);
  if (context.restored) url.searchParams.set("progressRestored", "1");
  return url.pathname + url.search;
}
export function progressReturnHref(context: ProgressReturn) {
  const query = new URLSearchParams({ framework: context.frameworkId });
  if (context.areaId) query.set("area", context.areaId);
  return "/progress?" + query;
}
const positionKey = (actor: string, framework: string) => JSON.stringify(["progress-position", actor, framework]);
export function rememberProgressPosition(storage: Pick<Storage, "setItem">, actor: string, framework: string, position: number) {
  if (!Number.isFinite(position) || position < 0) return;
  try { storage.setItem(positionKey(actor, framework), String(position)); } catch { /* Session storage is optional. */ }
}
export function readProgressPosition(storage: Pick<Storage, "getItem">, actor: string, framework: string) {
  try { const raw = storage.getItem(positionKey(actor, framework)), position = Number(raw);
    return raw !== null && Number.isFinite(position) && position >= 0 ? position : null;
  } catch { return null; }
}

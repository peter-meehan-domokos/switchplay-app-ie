export type ProgressReturn = { frameworkId: string; areaId?: string; restored?: boolean; experienceId?: string; subjectUserId?: string };
const valid = (value: string | null): value is string => !!value && value.trim() === value && value.length <= 200 && !/[\x00-\x1f]/.test(value);
export function readProgressReturn(query: { get(key: string): string | null }): ProgressReturn | null {
  const frameworkId = query.get("progressFramework"), areaId = query.get("progressArea");
  if (!valid(frameworkId) || (areaId !== null && !valid(areaId))) return null;
  const experienceId = query.get("progressExperience"), subjectUserId = query.get("progressPlayer");
  if (experienceId !== null && !valid(experienceId) || subjectUserId !== null && !valid(subjectUserId)) return null;
  return { frameworkId, ...(experienceId ? { experienceId, ...(subjectUserId ? { subjectUserId } : {}) } : {}), ...(areaId ? { areaId } : {}), ...(query.get("progressRestored") === "1" ? { restored: true } : {}) };
}
export function withProgressReturn(href: string, context: ProgressReturn | null) {
  if (!context) return href;
  const url = new URL(href, "http://switchplay.local");
  if (url.origin !== "http://switchplay.local" || (url.pathname !== "/decks" && !/^\/library\/[^/]+$/.test(url.pathname))) return href;
  url.searchParams.set("progressFramework", context.frameworkId);
  if (context.areaId) url.searchParams.set("progressArea", context.areaId);
  if (context.restored) url.searchParams.set("progressRestored", "1");
  if (context.experienceId) url.searchParams.set("progressExperience", context.experienceId);
  if (context.subjectUserId) url.searchParams.set("progressPlayer", context.subjectUserId);
  return url.pathname + url.search;
}
export function progressReturnHref(context: ProgressReturn) {
  const query = new URLSearchParams({ framework: context.frameworkId });
  if (context.areaId) query.set("area", context.areaId);
  if (context.experienceId) { query.set(context.subjectUserId ? "subjectUserId" : "perspective", context.subjectUserId ?? "group");
    return `/group-experiences/${encodeURIComponent(context.experienceId)}/progress?${query}`; }
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

export type GroupDeckReturn = { experienceId: string; cardId?: string; rotation: number; focused: boolean;
  selection: import("../groupExperiences/model").PerspectiveSelection; returnToProgress?: ProgressReturn };
export function groupProgressHref(experienceId: string, frameworkId?: string) {
  return `/group-experiences/${encodeURIComponent(experienceId)}/progress${frameworkId ? `?${new URLSearchParams({ framework: frameworkId })}` : ""}`;
}
export function groupDeckHref(value: GroupDeckReturn) {
  const query = new URLSearchParams({ openExperience: value.experienceId, progressScene: "1", progressFace: Math.abs(value.rotation % 360) === 180 ? "back" : "front",
    progressFocused: value.focused ? "1" : "0", progressPerspective: value.selection.perspective });
  if (value.cardId) query.set("openCard", value.cardId);
  if (value.selection.perspective === "follower") query.set("progressSubject", value.selection.subjectUserId);
  return withProgressReturn(`/decks?${query}`, value.returnToProgress ?? null);
}
export function readGroupDeckReturn(query: { get(key: string): string | null }, experienceId: string): GroupDeckReturn | undefined {
  if (query.get("progressScene") !== "1" || query.get("openExperience") !== experienceId) return;
  const perspective = query.get("progressPerspective"), subject = query.get("progressSubject"), cardId = query.get("openCard");
  if (perspective !== "group" && perspective !== "self" && perspective !== "follower" || perspective === "follower" && !valid(subject) || cardId !== null && !valid(cardId)) return;
  return { experienceId, ...(cardId ? { cardId } : {}), rotation: query.get("progressFace") === "back" ? 180 : 0,
    ...(readProgressReturn(query) ? { returnToProgress: readProgressReturn(query)! } : {}),
    focused: query.get("progressFocused") === "1", selection: perspective === "follower" ? { perspective, subjectUserId: subject! } : { perspective } };
}
const sceneKey = (actor: string, experience: string) => JSON.stringify(["group-progress-return", actor, experience]);
export function rememberGroupReturn(storage: Pick<Storage, "setItem">, actor: string, scene: GroupDeckReturn) {
  try { storage.setItem(sceneKey(actor, scene.experienceId), groupDeckHref(scene)); } catch { /* Returning without optional storage uses the current Group entry. */ }
}
export function recalledGroupHref(storage: Pick<Storage, "getItem">, actor: string, experienceId: string) {
  try {
    const href = storage.getItem(sceneKey(actor, experienceId));
    const parsed = new URL(href ?? "", "http://switchplay.local");
    const scene = parsed.origin === "http://switchplay.local" && parsed.pathname === "/decks" ? readGroupDeckReturn(parsed.searchParams, experienceId) : undefined;
    if (scene) return groupDeckHref(scene);
  } catch { /* Reject malformed or inaccessible optional storage. */ }
  return `/decks?${new URLSearchParams({ openExperience: experienceId })}`;
}

/** Explicit editor intent and bounded, same-application return context. */
export type CreatorSearch = Record<string, string | string[] | undefined>;
export type CreatorNavigation = { creating: boolean; draftOrigin: string | null; openDrafts: boolean };
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
const originKeys = ["entry", "returnTo", "returnDeckId", "version", "cards", "progressFramework", "progressArea", "draft"];

export function safeDraftOrigin(value: string | undefined): string | null {
  if (!value || value.length > 12000 || !/^\/creator\/(?:new|edit\/[^/?#]+|info-cards\/(?:new|[^/?#]+))(?:\?[^#]*)?$/.test(value)) return null;
  const url = new URL(value, "http://creator.local");
  if (url.origin !== "http://creator.local" || !/^\/creator\/(?:new|edit\/[^/?#]+|info-cards\/(?:new|[^/?#]+))$/.test(url.pathname)) return null;
  const query = new URLSearchParams();
  for (const key of originKeys) if (url.searchParams.has(key)) query.set(key, url.searchParams.get(key)!);
  return url.pathname + (query.size ? `?${query}` : "");
}
export function creatorNavigation(query: CreatorSearch, newItem = false): CreatorNavigation {
  return { creating: newItem || first(query.entry) === "create", draftOrigin: safeDraftOrigin(first(query.draftOrigin)), openDrafts: first(query.drafts) === "1" };
}
export function infoEditorHref(id: string, saved: boolean, navigation: CreatorNavigation) {
  const query = new URLSearchParams();
  if (!saved) query.set("draft", id);
  if (navigation.creating) query.set("entry", "create");
  if (navigation.draftOrigin) query.set("draftOrigin", navigation.draftOrigin);
  return `/creator/info-cards/${saved ? encodeURIComponent(id) : "new"}${query.size ? `?${query}` : ""}`;
}
export function draftsReturnTarget(origin: string) {
  const url = new URL(origin, "http://creator.local"); url.searchParams.set("drafts", "1");
  return { label: "Back to My Drafts" as const, href: url.pathname + url.search };
}
export function currentDraftOrigin(location: { pathname: string; search: string }) {
  const query = new URLSearchParams(location.search);
  return safeDraftOrigin(query.get("draftOrigin") ?? undefined) ?? safeDraftOrigin(location.pathname + location.search) ?? "/creator/new";
}

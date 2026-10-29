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
export function currentDraftOrigin(location: { pathname: string; search: string }) {
  const query = new URLSearchParams(location.search);
  return safeDraftOrigin(query.get("draftOrigin") ?? undefined) ?? safeDraftOrigin(location.pathname + location.search) ?? "/creator/new";
}

export function deckCollectionTarget(input: { creating: boolean; visibility: "private" | "public"; origin?: "library" | "my-decks";
  copied: boolean; id: string; reveal?: boolean; publicationVersion?: number | null }) {
  const library = input.copied && input.visibility === "private" ? false
    : input.creating ? input.visibility === "public" : input.origin ? input.origin === "library" : input.visibility === "public";
  return { label: library ? "Library" as const : "My Decks" as const,
    href: library ? `/library${input.publicationVersion ? `?${new URLSearchParams({ published: input.id })}` : ""}`
      : `/decks${input.reveal === false ? "" : `?${new URLSearchParams({ reveal: input.id })}`}` };
}
export function infoCollectionTarget(id: string, publicationVersion?: number | null) {
  return { label: "Library", href: `/library?${new URLSearchParams({ tab: "info-cards", ...(publicationVersion ? { published: id } : {}) })}` };
}

export function deckReturnOrigin(query: CreatorSearch, id: string): "library" | "my-decks" | undefined {
  let target = first(query.returnTo);
  if (!target) {
    const origin = safeDraftOrigin(first(query.draftOrigin));
    if (origin) {
      const url = new URL(origin, "http://creator.local");
      if (url.pathname === `/creator/edit/${encodeURIComponent(id)}`) target = url.searchParams.get("returnTo") ?? undefined;
    }
  }
  return target === "library" ? "library" : target === "deck" ? "my-decks" : undefined;
}

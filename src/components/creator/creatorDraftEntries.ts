import type { CreatorDraftSummary } from "@/lib/cards/creatorDrafts";
import type { InfoRoot } from "@/lib/infoCards/model";
import type { CreatorTransport } from "./creatorRequest";
import { safeDraftOrigin } from "./creatorNavigation";

export type CreatorDraftEntry = (CreatorDraftSummary & { kind: "deck" }) | {
  kind: "infoCard"; infoCardId: string; title: string; updatedAt: string;
};
export async function loadCreatorDraftEntries(request: CreatorTransport): Promise<{ items: CreatorDraftEntry[]; error: string }> {
  const [decks, info] = await Promise.allSettled([
    request<CreatorDraftSummary[]>("/api/creator/drafts"),
    (async () => {
      const entries: CreatorDraftEntry[] = []; let offset: number | null = 0;
      do {
        const page: { items: InfoRoot[]; nextOffset: number | null } = await request(`/api/info-cards?limit=50&offset=${offset}`);
        for (const root of page.items) if (!entries.some(entry => entry.kind === "infoCard" && entry.infoCardId === root.infoCardId)) {
          entries.push({ kind: "infoCard", infoCardId: root.infoCardId, title: root.draft?.title ?? "", updatedAt: new Date(root.updatedAt).toISOString() });
        }
        offset = page.nextOffset;
      } while (offset !== null);
      return entries;
    })(),
  ]);
  const items = [...(decks.status === "fulfilled" ? decks.value.map(entry => ({ ...entry, kind: "deck" as const })) : []), ...(info.status === "fulfilled" ? info.value : [])];
  return { items: items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    error: [decks.status === "rejected" ? "Deck drafts could not be loaded." : "", info.status === "rejected" ? "Info Card drafts could not be loaded." : ""].filter(Boolean).join(" ") };
}
export function creatorDraftHref(id: string, kind: CreatorDraftEntry["kind"], origin?: string) {
  const path = kind === "infoCard" ? `/creator/info-cards/${encodeURIComponent(id)}` : `/creator/edit/${encodeURIComponent(id)}`;
  const safe = safeDraftOrigin(origin);
  return safe ? `${path}?${new URLSearchParams({ draftOrigin: safe })}` : path;
}

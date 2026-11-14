import type { CreatorDraftSummary } from "@/lib/cards/creatorDrafts";
import type { InfoRoot, PublicationRequestState } from "@/lib/infoCards/model";
import { publicationNotice, type InfoCardPublicationNotice } from "../info-cards/infoCardPublicationLayout";
import type { CreatorTransport } from "./creatorRequest";
import { safeDraftOrigin } from "./creatorNavigation";
import { infoCardOrigin, originLabel } from "@/lib/groupExperiences/media/contributionIdentity";

export type CreatorDraftEntry = (CreatorDraftSummary & { kind: "deck" }) | {
  kind: "infoCard"; infoCardId: string; title: string; updatedAt: string; purpose?: "personal";
  // An unsaved Group draft: where it was created, for example "Group A · Me" (C3).
  origin?: string;
  // A stored Publish or Save still waiting for its video, or one that failed (checkpoint 10).
  publication?: InfoCardPublicationNotice;
};
// Opening My Drafts resumes pending Info Card requests on the server. Drafts still waiting or failed carry their
// notice; requests completed by this visit are no longer drafts and are returned as confirmations.
export async function loadCreatorDraftEntries(request: CreatorTransport): Promise<{ items: CreatorDraftEntry[]; error: string; notices: InfoCardPublicationNotice[] }> {
  const states: PublicationRequestState[] = [];
  const [decks, info] = await Promise.allSettled([
    request<CreatorDraftSummary[]>("/api/creator/drafts"),
    (async () => {
      const entries: CreatorDraftEntry[] = []; let offset: number | null = 0;
      do {
        const page: { items: InfoRoot[]; nextOffset: number | null; publications?: PublicationRequestState[]; groupNames?: Record<string, string> } = await request(`/api/info-cards?limit=50&offset=${offset}`);
        states.push(...page.publications ?? []);
        for (const root of page.items) if (!entries.some(entry => entry.kind === "infoCard" && entry.infoCardId === root.infoCardId)) {
          const state = states.find(item => item.infoCardId === root.infoCardId && item.status !== "published");
          entries.push({ kind: "infoCard", infoCardId: root.infoCardId, title: root.draft?.title ?? "", updatedAt: new Date(root.updatedAt).toISOString(),
            ...(root.kind === "personal" || root.kind === "group" ? { purpose: "personal" as const } : {}),
            ...(root.kind === "group" && root.experienceId ? { origin: originLabel(infoCardOrigin(root), page.groupNames?.[root.experienceId]) } : {}),
            ...(state ? { publication: publicationNotice(state) } : {}) });
        }
        offset = page.nextOffset;
      } while (offset !== null);
      return entries;
    })(),
  ]);
  const items = [...(decks.status === "fulfilled" ? decks.value.map(entry => ({ ...entry, kind: "deck" as const })) : []), ...(info.status === "fulfilled" ? info.value : [])];
  return { items: items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    notices: states.filter(state => state.status === "published").map(publicationNotice),
    error: [decks.status === "rejected" ? "Deck drafts could not be loaded." : "", info.status === "rejected" ? "Info Card drafts could not be loaded." : ""].filter(Boolean).join(" ") };
}
export function creatorDraftHref(id: string, kind: CreatorDraftEntry["kind"], origin?: string) {
  const path = kind === "infoCard" ? `/creator/info-cards/${encodeURIComponent(id)}` : `/creator/edit/${encodeURIComponent(id)}`;
  const safe = safeDraftOrigin(origin);
  return safe ? `${path}?${new URLSearchParams({ draftOrigin: safe })}` : path;
}

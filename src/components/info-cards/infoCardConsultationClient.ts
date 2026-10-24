import type { MainInfoContext, InfoConsultationSnapshot } from "@/lib/infoCards/model";
import type { InfoCardConsultationCard } from "./InfoCardConsultation";

export type ConsultationRequest = MainInfoContext & { actor: string; mainCardId: string; attachmentIds: readonly string[] };

// No content cache: every genuine opening obtains one new immutable snapshot.
export async function loadInfoConsultation(context: ConsultationRequest, signal: AbortSignal): Promise<InfoCardConsultationCard[]> {
  const query = new URLSearchParams({ mode: context.mode, version: String(context.version),
    ...(context.mode === "working" ? { deckTemplateId: context.deckTemplateId! } : {}) });
  const response = await fetch(`/api/card-templates/${encodeURIComponent(context.mainCardId)}/info-cards?${query}`, {
    signal, cache: "no-store", headers: { "X-Personal-Viewer": context.actor },
  });
  if (!response.ok || response.headers.get("X-Personal-Viewer") !== context.actor) throw new Error("Info Cards unavailable");
  const snapshot = await response.json() as InfoConsultationSnapshot;
  if (snapshot.mainCardId !== context.mainCardId || snapshot.mainCardVersion !== context.version
    || !Array.isArray(snapshot.entries) || snapshot.entries.length !== context.attachmentIds.length) throw new Error("Invalid consultation snapshot");
  // Reuse the existing actor-bound transport convention: cookie changes while a
  // response is in flight must not install another session's private content.
  const auth = await fetch("/api/auth/me", { signal, cache: "no-store" });
  if (!auth.ok || (await auth.json()).user?.id !== context.actor) throw new Error("Consultation session changed");
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  return snapshot.entries.map((entry, index) => {
    if (entry.status === "unavailable") return { id: `${context.mainCardId}:unavailable:${index}`, unavailable: true };
    if (entry.status !== "available" || entry.info.infoCardId !== context.attachmentIds[index]
      || !Number.isSafeInteger(entry.info.version) || entry.info.version < 1) throw new Error("Invalid consultation entry");
    const info = entry.info;
    return { id: info.infoCardId, title: info.content.title, body: info.content.body, seriesTitle: info.series.title,
      seriesCreatorUsername: info.series.creatorUsername, ...(info.content.mediaItem ? { media: info.content.mediaItem } : {}),
      publication: { infoCardId: info.infoCardId, kind: "publication", version: info.version } };
  });
}

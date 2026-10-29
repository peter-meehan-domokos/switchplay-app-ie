import type { MainInfoContext, InfoConsultationSnapshot } from "@/lib/infoCards/model";
import type { InfoCardConsultationCard } from "./InfoCardConsultation";

export type ConsultationRequest = MainInfoContext & { actor: string; mainCardId: string; attachmentIds: readonly string[] };

// No content cache: every genuine opening obtains one new immutable snapshot.
export async function loadInfoConsultation(context: ConsultationRequest, signal: AbortSignal,
  onSnapshot?: (snapshot: InfoConsultationSnapshot) => void): Promise<InfoCardConsultationCard[]> {
  const query = new URLSearchParams({ mode: context.mode, version: String(context.version),
    ...(context.mode === "working" ? { deckTemplateId: context.deckTemplateId! } : {}) });
  const response = await fetch(`/api/card-templates/${encodeURIComponent(context.mainCardId)}/info-cards?${query}`, {
    signal, cache: "no-store", headers: { "X-Personal-Viewer": context.actor },
  });
  if (!response.ok || response.headers.get("X-Personal-Viewer") !== context.actor) throw new Error("Info Cards unavailable");
  const snapshot = await response.json() as InfoConsultationSnapshot;
  if (snapshot.mainCardId !== context.mainCardId || snapshot.mainCardVersion !== context.version
    || !Array.isArray(snapshot.entries)) throw new Error("Invalid consultation snapshot");
  const modern = snapshot.personalSources !== undefined || snapshot.entries.some(entry => entry.key !== undefined || entry.status === "available" && entry.source !== undefined);
  if ((!modern || context.mode === "canonical") && snapshot.entries.length !== context.attachmentIds.length) throw new Error("Invalid consultation snapshot");
  if (snapshot.personalSources && (context.mode !== "working" || !Array.isArray(snapshot.personalSources)
    || snapshot.personalSources.some(source => typeof source.cardTemplateId !== "string" || !Number.isSafeInteger(source.personalInfoRevision) || source.personalInfoRevision < 0)
    || new Set(snapshot.personalSources.map(source => source.cardTemplateId)).size !== snapshot.personalSources.length)) throw new Error("Invalid personal sources");
  // Reuse the existing actor-bound transport convention: cookie changes while a
  // response is in flight must not install another session's private content.
  const auth = await fetch("/api/auth/me", { signal, cache: "no-store" });
  if (!auth.ok || (await auth.json()).user?.id !== context.actor) throw new Error("Consultation session changed");
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  const seen = new Set<string>();
  const cards: InfoCardConsultationCard[] = snapshot.entries.map((entry, index) => {
    if (entry.status === "unavailable") return { id: entry.key ?? `${context.mainCardId}:unavailable:${index}`, unavailable: true };
    if (entry.status !== "available"
      || !Number.isSafeInteger(entry.info.version) || entry.info.version < 1) throw new Error("Invalid consultation entry");
    const info = entry.info;
    if (seen.has(info.infoCardId)) throw new Error("Duplicate consultation entry"); seen.add(info.infoCardId);
    const source = snapshot.personalSources?.find(source => source.cardTemplateId === entry.sourceCardTemplateId);
    if (entry.source === "personal") {
      if (context.mode !== "working" || !source || info.kind !== "personal" || info.ownerUserId !== context.actor
        || info.visibility !== "private" || info.originCardTemplateId !== source.cardTemplateId) throw new Error("Invalid personal entry");
    } else if (info.kind === "personal" || (modern ? !context.attachmentIds.includes(info.infoCardId) : info.infoCardId !== context.attachmentIds[index])) throw new Error("Invalid shared entry");
    return { id: info.infoCardId, title: info.content.title, body: info.content.body, bodyFormat: info.content.bodyFormat, seriesTitle: info.series.title,
      creatorUsername: info.creatorUsername, personal: entry.source === "personal", ...(source ? { personalSource: source } : {}),
      seriesCreatorUsername: info.series.creatorUsername, ...(info.content.mediaItem ? { media: info.content.mediaItem } : {}),
      publication: { infoCardId: info.infoCardId, kind: "publication", version: info.version } };
  });
  if (cards.length < context.attachmentIds.length) throw new Error("Missing shared positions");
  onSnapshot?.(snapshot);
  return cards;
}

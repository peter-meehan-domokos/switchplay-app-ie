import type { MainInfoContext, InfoConsultationSnapshot } from "@/lib/infoCards/model";
import type { InfoCardConsultationCard } from "./InfoCardConsultation";
import { actingOrigin, infoCardOrigin, originLabel, sameOrigin, STANDALONE_ORIGIN } from "@/lib/groupExperiences/media/contributionIdentity";

export type ConsultationRequest = MainInfoContext & { actor: string; mainCardId: string; attachmentIds: readonly string[] };

// No content cache: every genuine opening obtains one new immutable snapshot.
// Modes: working (standalone Card), experience (the viewer own Me in a Group) and canonical (everything else).
export async function loadInfoConsultation(context: ConsultationRequest, signal: AbortSignal,
  onSnapshot?: (snapshot: InfoConsultationSnapshot) => void): Promise<InfoCardConsultationCard[]> {
  const query = new URLSearchParams({ mode: context.mode, version: String(context.version),
    ...(context.mode === "working" ? { deckTemplateId: context.deckTemplateId! } : {}),
    ...(context.mode === "experience" ? { experienceId: context.experienceId! } : {}) });
  const response = await fetch(`/api/card-templates/${encodeURIComponent(context.mainCardId)}/info-cards?${query}`, {
    signal, cache: "no-store", headers: { "X-Personal-Viewer": context.actor },
  });
  if (!response.ok || response.headers.get("X-Personal-Viewer") !== context.actor) throw new Error("Info Cards unavailable");
  const snapshot = await response.json() as InfoConsultationSnapshot;
  if (snapshot.mainCardId !== context.mainCardId || snapshot.mainCardVersion !== context.version
    || !Array.isArray(snapshot.entries)) throw new Error("Invalid consultation snapshot");
  const ownNotes = context.mode === "working" || context.mode === "experience";
  const modern = snapshot.personalSources !== undefined || snapshot.entries.some(entry => entry.key !== undefined || entry.status === "available" && entry.source !== undefined);
  if ((!modern || context.mode === "canonical") && snapshot.entries.length !== context.attachmentIds.length) throw new Error("Invalid consultation snapshot");
  if (snapshot.personalSources && (!ownNotes || !Array.isArray(snapshot.personalSources)
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
      if (!ownNotes || !source || info.kind !== "personal" || info.ownerUserId !== context.actor
        || info.visibility !== "private" || info.originCardTemplateId !== source.cardTemplateId) throw new Error("Invalid personal entry");
    } else if (entry.source === "group") {
      // The viewer own Follower contribution (checkpoint 4.2), only in their own contexts.
      if (!ownNotes || info.kind !== "group" || info.creationContext !== "self" || info.ownerUserId !== context.actor
        || info.visibility !== "private" || info.originCardTemplateId !== context.mainCardId || typeof info.experienceId !== "string") throw new Error("Invalid Group note entry");
    } else if (info.kind === "personal" || info.kind === "group" || (modern ? !context.attachmentIds.includes(info.infoCardId) : info.infoCardId !== context.attachmentIds[index])) throw new Error("Invalid shared entry");
    if (entry.private !== undefined && (context.mode !== "experience" || entry.source === "shared" || typeof entry.private !== "boolean")) throw new Error("Invalid visibility");
    if (entry.originName !== undefined && (entry.source !== "group" || entry.originName !== null && typeof entry.originName !== "string")) throw new Error("Invalid origin");
    // Edit and Remove only in the exact creation context (C1): standalone notes on the standalone Card, Follower
    // contributions in Me of their own Group. Elsewhere the menu names where the note was created.
    const acting = actingOrigin(context.mode === "experience" ? context.experienceId : undefined, "self");
    const groupNote = entry.source === "group" ? { experienceId: info.experienceId!, editable: sameOrigin(infoCardOrigin(info), acting) } : undefined;
    const origin = entry.source === "group" ? originLabel(infoCardOrigin(info), entry.originName) : entry.source === "personal" ? originLabel(STANDALONE_ORIGIN) : undefined;
    return { id: info.infoCardId, title: info.content.title, body: info.content.body, bodyFormat: info.content.bodyFormat, seriesTitle: info.series.title,
      creatorUsername: info.creatorUsername, personal: entry.source === "personal" || entry.source === "group",
      ...(source && context.mode === "working" ? { personalSource: source } : {}), ...(groupNote ? { groupNote } : {}), ...(origin ? { origin } : {}),
      ...(entry.private !== undefined ? { groupVisibility: entry.private ? "private" as const : "visible" as const } : {}),
      seriesCreatorUsername: info.series.creatorUsername, ...(info.content.mediaItem ? { media: info.content.mediaItem } : {}),
      publication: { infoCardId: info.infoCardId, kind: "publication", version: info.version } };
  });
  if (cards.length < context.attachmentIds.length) throw new Error("Missing shared positions");
  onSnapshot?.(snapshot);
  return cards;
}

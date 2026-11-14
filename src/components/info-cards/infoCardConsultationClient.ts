import type { MainInfoContext, InfoConsultationSnapshot } from "@/lib/infoCards/model";
import type { InfoCardConsultationCard } from "./InfoCardConsultation";
import { actingOrigin, infoCardOrigin, originLabel, sameOrigin, STANDALONE_ORIGIN } from "@/lib/groupExperiences/media/contributionIdentity";

export type ConsultationRequest = MainInfoContext & { actor: string; mainCardId: string; attachmentIds: readonly string[] };

// No content cache: every genuine opening obtains one new immutable snapshot.
// Modes: working (standalone Card), experience (the viewer own Me in a Group), group (the Group perspective, or
// with subjectUserId follower inspection, checkpoint 4.4) and canonical (everything else).
export async function loadInfoConsultation(context: ConsultationRequest, signal: AbortSignal,
  onSnapshot?: (snapshot: InfoConsultationSnapshot) => void): Promise<InfoCardConsultationCard[]> {
  const query = new URLSearchParams({ mode: context.mode, version: String(context.version),
    ...(context.mode === "working" ? { deckTemplateId: context.deckTemplateId! } : {}),
    ...(context.mode === "experience" || context.mode === "group" ? { experienceId: context.experienceId! } : {}),
    ...(context.mode === "group" && context.subjectUserId ? { subjectUserId: context.subjectUserId } : {}),
    ...(context.mode === "group" && context.subjectUserId && context.includeGroupContent ? { includeGroupContent: "1" } : {}) });
  const response = await fetch(`/api/card-templates/${encodeURIComponent(context.mainCardId)}/info-cards?${query}`, {
    signal, cache: "no-store", headers: { "X-Personal-Viewer": context.actor },
  });
  if (!response.ok || response.headers.get("X-Personal-Viewer") !== context.actor) throw new Error("Info Cards unavailable");
  const snapshot = await response.json() as InfoConsultationSnapshot;
  if (snapshot.mainCardId !== context.mainCardId || snapshot.mainCardVersion !== context.version
    || !Array.isArray(snapshot.entries)) throw new Error("Invalid consultation snapshot");
  const ownNotes = context.mode === "working" || context.mode === "experience", groupMode = context.mode === "group";
  if (snapshot.canHide !== undefined && (!groupMode || typeof snapshot.canHide !== "boolean")) throw new Error("Invalid consultation snapshot");
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
      // In the viewer own contexts, their own Follower contributions (checkpoint 4.2), and in Me also this Group's
      // Admin contributions (V1, checkpoint 4.5). In the Group perspective, any contribution of this Group; in
      // follower inspection, only that follower's Follower contributions (4.4), plus this Group's Admin
      // contributions when Include Group content is on (4.5).
      const groupAdmin = info.creationContext === "group" && info.experienceId === context.experienceId;
      if (info.kind !== "group" || info.visibility !== "private" || info.originCardTemplateId !== context.mainCardId || typeof info.experienceId !== "string"
        || (ownNotes ? !(info.creationContext === "self" && info.ownerUserId === context.actor || context.mode === "experience" && groupAdmin)
          : !groupMode || info.experienceId !== context.experienceId || !!context.subjectUserId
            && !(info.creationContext === "self" && info.ownerUserId === context.subjectUserId || !!context.includeGroupContent && groupAdmin))) throw new Error("Invalid Group note entry");
    } else if (info.kind === "personal" || info.kind === "group" || (modern ? !context.attachmentIds.includes(info.infoCardId) : info.infoCardId !== context.attachmentIds[index])) throw new Error("Invalid shared entry");
    if (entry.private !== undefined && (context.mode !== "experience" || entry.source === "shared" || typeof entry.private !== "boolean")) throw new Error("Invalid visibility");
    if (entry.originName !== undefined && (entry.source !== "group" || entry.originName !== null && typeof entry.originName !== "string")) throw new Error("Invalid origin");
    // Edit and Remove only on the viewer own note in its exact creation context (C1): standalone notes on the
    // standalone Card, Follower contributions in Me of their Group, Admin contributions in the Group perspective of
    // their Group. Elsewhere the viewer own note names where it was created. A Group admin may hide any other
    // contribution shown in the Group perspective or follower inspection (C2).
    const own = info.ownerUserId === context.actor;
    const acting = actingOrigin(context.mode === "experience" || groupMode ? context.experienceId : undefined, groupMode && !context.subjectUserId ? "group" : "self");
    const editable = own && sameOrigin(infoCardOrigin(info), acting);
    // The viewer's own Admin contribution outside the Group perspective (an inspection with Include Group content,
    // 4.5c) is managed only where it was created, as for media: its origin, never Hide.
    const hideable = groupMode && snapshot.canHide && !editable && !(own && info.creationContext === "group");
    const groupNote = entry.source === "group" ? { experienceId: info.experienceId!, editable, ...(hideable ? { canHide: true } : {}) } : undefined;
    const origin = !own ? undefined : entry.source === "group" ? originLabel(infoCardOrigin(info), entry.originName) : entry.source === "personal" ? originLabel(STANDALONE_ORIGIN) : undefined;
    return { id: info.infoCardId, title: info.content.title, body: info.content.body, bodyFormat: info.content.bodyFormat, seriesTitle: info.series.title,
      creatorUsername: info.creatorUsername, personal: entry.source === "personal" || entry.source === "group",
      // A card's type follows where it was created (D1): Admin contributions are Group Admin Info Cards.
      ...(entry.source === "group" && info.creationContext === "group" ? { infoType: "groupAdmin" as const } : {}),
      ...(source && context.mode === "working" ? { personalSource: source } : {}), ...(groupNote ? { groupNote } : {}), ...(origin ? { origin } : {}),
      ...(entry.private !== undefined ? { groupVisibility: entry.private ? "private" as const : "visible" as const } : {}),
      seriesCreatorUsername: info.series.creatorUsername, ...(info.content.mediaItem ? { media: info.content.mediaItem } : {}),
      // A Group contribution read in the Group is delivered to its members through that Group, as is an Admin
      // contribution shown in a follower's Me (V1); the viewer's own Follower contributions in Me are their own.
      publication: { infoCardId: info.infoCardId, kind: "publication", version: info.version,
        ...(entry.source === "group" && (groupMode || context.mode === "experience" && info.creationContext === "group") ? { experienceId: context.experienceId! } : {}) } };
  });
  if (cards.length < context.attachmentIds.length) throw new Error("Missing shared positions");
  onSnapshot?.(snapshot);
  return cards;
}

import { projectCollectiveReflection } from "./collective";
import type { CollectiveReflection } from "./model";
import { ObjectId, type ClientSession } from "mongodb";
import { requireCondition } from "../cards/domain";
import { creatorUsernames } from "../cards/creatorAttribution";
import type { GroupExperienceRepository } from "../groupExperiences/repository";
import { selectedCard } from "../groupExperiences/publicVersions";
import { canInspectPeers } from "../groupExperiences/policy";
import { id } from "../groupExperiences/contracts";
import { GROUP_REFLECTIONS } from "./indexes";
import { ownReflectionItems, sharedReflectionItems } from "./presentation";
import { reflectionSlotKey, type GroupReflection, type ReflectionEntry, type ReflectionDisplayItem } from "./model";

export type ReflectionView = { kind: "personal" } | { kind: "group"; experienceId: string; mode: "own" | "group" | "inspection"; subjectUserId?: string; accessEpoch: number };
export type ReflectionItem = ReflectionDisplayItem & { canEdit: boolean; canDelete: boolean; canHide: boolean; explanation: string | null };
export type ReflectionFeed = { viewerUserId: string; cardTemplateId: string; view: ReflectionView; items: ReflectionItem[]; historyComplete?: boolean; collective?: CollectiveReflection; accessEpoch: number | null; adoptionRevision: number | null };
const groupProjection = { _id: 0, reflectionId: 1, experienceId: 1, cardTemplateId: 1, authorUserId: 1, text: 1, revision: 1, createdAt: 1, groupVisible: 1, deleted: 1 };
const personalKey = (actor: string) => /^[a-f\d]{24}$/i.test(actor) ? new ObjectId(actor) : actor;
export async function readReflectionFeed(groups: GroupExperienceRepository, actor: string, cardTemplateId: string, view: ReflectionView): Promise<ReflectionFeed> {
  id(actor); id(cardTemplateId);
  const transaction = view.kind === "personal" ? groups.cards.transaction.bind(groups.cards) : groups.transaction.bind(groups);
  return transaction(async session => (await readReflectionFeedsInSession(groups, actor, [cardTemplateId], view, session))[cardTemplateId]);
}
// The composed reader supplies already validated selected content. All queries
// share its snapshot; the ordinary single-Card feed uses the same projection.
export async function readReflectionFeedsInSession(groups: GroupExperienceRepository, actor: string, ids: string[], view: ReflectionView, session: ClientSession,
  checked?: Awaited<ReturnType<GroupExperienceRepository["access"]>>, previewOnly = false): Promise<Record<string, ReflectionFeed>> {
  const rows = groups.cards.db.collection<GroupReflection>(GROUP_REFLECTIONS);
  const authority = view.kind === "group" ? checked ?? await groups.access(actor, view.experienceId, "member", session, view.accessEpoch) : null;
  if (authority && view.kind === "group") requireCondition(authority.member.userId === actor && authority.experience.experienceId === view.experienceId && authority.member.accessEpoch === view.accessEpoch, "GROUP_PERSPECTIVE_FORBIDDEN");
  if (authority && !checked) for (const card of ids) await selectedCard(groups.cards, authority.experience, card, session);
  if (view.kind === "group" && view.mode === "inspection") {
    id(view.subjectUserId);
    const subject = await groups.members().findOne({ experienceId: view.experienceId, userId: view.subjectUserId }, { session });
    requireCondition(subject?.followerStatus === "active" && canInspectPeers(authority!.experience, authority!.member), "GROUP_PERSPECTIVE_FORBIDDEN");
  }
  const owner = view.kind === "personal" || view.mode === "own", currentOnly = owner && previewOnly;
  if (view.kind === "group" && view.mode === "own") requireCondition(authority!.member.followerStatus === "active", "GROUP_PERSPECTIVE_FORBIDDEN");
    // Foreign feeds never query Personal CardData, hidden rows or other origins.
    const allRecords = currentOnly && view.kind === "personal" ? [] : await rows.find({ cardTemplateId: { $in: ids }, ...(owner ? { authorUserId: actor, ...(currentOnly && view.kind === "group" ? { experienceId: view.experienceId } : {}) } : {
      experienceId: (view as Extract<ReflectionView, {kind:"group"}>).experienceId, groupVisible: true, deleted: false, text: { $regex: "\\S" },
      ...(view.kind === "group" && view.mode === "inspection" ? { authorUserId: view.subjectUserId } : {}),
    }) }, { session, projection: groupProjection }).sort({ createdAt: -1, reflectionId: 1 }).toArray();
    // Admin's own working slot is retained even when hidden/cleared; not a foreign grant.
    if (!owner && view.kind === "group" && view.mode === "group" && authority!.member.isAdmin) {
      const own = await rows.find({ experienceId: view.experienceId, cardTemplateId: { $in: ids }, authorUserId: actor }, { session, projection: groupProjection }).toArray();
      for (const row of own) if (!allRecords.some(r => r.reflectionId === row.reflectionId)) allRecords.push(row);
    }
    const originIds = [...new Set(allRecords.map(r => r.experienceId))];
    if (view.kind === "group" && !originIds.includes(view.experienceId)) originIds.push(view.experienceId);
    const origins = currentOnly && authority ? [authority.experience] : await groups.experiences().find({ experienceId: { $in: originIds } }, { session, projection: { _id: 0, experienceId: 1, name: 1, deckTemplateId: 1, deckVersion: 1, cardSelections: 1 } }).toArray();
    const memberships = owner && !currentOnly ? await groups.members().find({ experienceId: { $in: originIds }, userId: actor }, { session, projection: { _id: 0, experienceId: 1, isAdmin: 1, followerStatus: 1 } }).toArray() : [];
    // Batch current origin scope for truthful read-only explanations. These
    // checks never gate author history or deletion after leaving an origin.
    const decks = owner && !currentOnly && origins.length ? await groups.cards.deckVersions().find({ $or: origins.map(o => ({ deckTemplateId: o.deckTemplateId, version: o.deckVersion })) },
      { session, projection: { _id: 0, deckTemplateId: 1, version: 1, visibility: 1, "content.cards.cardTemplateId": 1 } }).toArray() : [];
    const deckRoots = owner && !currentOnly && origins.length ? await groups.cards.decks().find({ deckTemplateId: { $in: origins.map(o => o.deckTemplateId) } },
      { session, projection: { _id: 0, deckTemplateId: 1, visibility: 1 } }).toArray() : [];
    const selectedVersions = origins.flatMap(o => o.cardSelections.filter(c => ids.includes(c.cardTemplateId)).map(c => ({ cardTemplateId: c.cardTemplateId, version: c.version })));
    const cardVersions = owner && !currentOnly && selectedVersions.length ? await groups.cards.cardVersions().find({ $or: selectedVersions },
      { session, projection: { _id: 0, cardTemplateId: 1, version: 1, visibility: 1 } }).toArray() : [];
    const cardRoots = owner && !currentOnly && selectedVersions.length ? await groups.cards.cards().find({ cardTemplateId: { $in: ids } }, { session, projection: { _id: 0, cardTemplateId: 1, visibility: 1 } }).toArray() : [];
    const names = await creatorUsernames(groups.cards, [actor, ...allRecords.map(r => r.authorUserId)], session);
    const personalRows = owner && (!currentOnly || view.kind === "personal") ? await groups.cards.users().aggregate<{ cardsData: { cardTemplateId: string; reflection: string; reflectionRevision?: number; reflectionCreatedAt?: Date | null }[] }>([
      { $match: { _id: personalKey(actor) } },
      { $project: { cardsData: { $filter: { input: "$cardsData", as: "c", cond: { $in: ["$$c.cardTemplateId", { $literal: ids }] } } } } },
      { $project: { _id: 0, "cardsData.cardTemplateId": 1, "cardsData.reflection": 1, "cardsData.reflectionRevision": 1, "cardsData.reflectionCreatedAt": 1 } },
    ], { session }).next() : null;
    const collective = view.kind === "group" && view.mode === "group" ? await groups.cardData().find({ experienceId: view.experienceId, cardTemplateId: { $in: ids } }, { session, projection: { _id: 0, cardTemplateId: 1, reflection: 1, reflectionRevision: 1 } }).toArray() : [];
    return Object.fromEntries(ids.map(cardTemplateId => {
    const context = { ...view, cardTemplateId, viewerUserId: actor }, records = allRecords.filter(row => row.cardTemplateId === cardTemplateId);
    const cardRoot = cardRoots.find(row => row.cardTemplateId === cardTemplateId);
    const originEditable = new Set(origins.filter(o => {
      const selected = o.cardSelections.filter(c => c.cardTemplateId === cardTemplateId), deck = decks.find(d => d.deckTemplateId === o.deckTemplateId && d.version === o.deckVersion);
      return selected.length === 1 && cardRoot?.visibility === "public" && cardVersions.some(c => c.cardTemplateId === cardTemplateId && c.version === selected[0].version && c.visibility === "public")
        && deckRoots.some(d => d.deckTemplateId === o.deckTemplateId && d.visibility === "public") && deck?.visibility === "public"
        && deck.content.cards.some(c => c.cardTemplateId === cardTemplateId);
    }).map(o => o.experienceId));
    const entries: ReflectionEntry[] = records.filter(r => !r.deleted && r.text.trim()).map(row => ({ source: { kind: "group", experienceId: row.experienceId, cardTemplateId, reflectionId: row.reflectionId },
      authorUserId: row.authorUserId, authorName: names.get(row.authorUserId) ?? "Unknown member", text: row.text, revision: row.revision,
      createdAt: row.createdAt.toISOString(), originName: origins.find(o => o.experienceId === row.experienceId)?.name ?? "Unavailable Group", groupVisible: row.groupVisible }));
    let personal: ReflectionEntry | undefined;
    if (owner) {
      const matches = personalRows?.cardsData?.filter(row => row.cardTemplateId === cardTemplateId) ?? [];
      requireCondition(matches.length <= 1, "REFLECTION_SOURCE_CONFLICT");
      const p = matches[0];
      personal = { source: { kind: "personal", cardTemplateId }, authorUserId: actor, authorName: names.get(actor) ?? "Unknown member", text: p?.reflection ?? "", revision: p?.reflectionRevision ?? 0,
        createdAt: p?.reflectionCreatedAt?.toISOString() ?? null, originName: "Personal", groupVisible: false };
      if (personal.text.trim()) entries.push(personal);
    }
    const currentGroup = view.kind === "group" ? records.find(r => r.authorUserId === actor && r.experienceId === view.experienceId) : null;
    const currentSlot: ReflectionEntry = view.kind === "personal" ? personal! : {
      source: { kind: "group", experienceId: view.experienceId, cardTemplateId, reflectionId: currentGroup?.reflectionId ?? null },
      authorUserId: actor, authorName: names.get(actor) ?? "Unknown member", text: currentGroup?.deleted ? "" : currentGroup?.text ?? "", revision: currentGroup?.revision ?? 0,
      createdAt: currentGroup?.createdAt.toISOString() ?? null, originName: authority!.experience.name, groupVisible: currentGroup?.groupVisible ?? true,
    };
    let display: ReflectionDisplayItem[];
    if (owner) display = ownReflectionItems(context, currentSlot, entries);
    else {
      display = sharedReflectionItems(context as Extract<typeof context, {kind:"group"}>, entries.filter(e => e.groupVisible), view.kind === "group" ? view.subjectUserId : undefined);
      if (view.kind === "group" && view.mode === "group" && authority!.member.isAdmin) {
        display = [{ entry: currentSlot, empty: !currentSlot.text.trim(), label: currentSlot.authorName, private: !currentSlot.groupVisible }, ...display.filter(i => reflectionSlotKey(i.entry) !== reflectionSlotKey(currentSlot))];
      }
    }
    const feed: ReflectionFeed = { viewerUserId: actor, cardTemplateId, view, ...(currentOnly ? { historyComplete: false } : {}),
      ...(view.kind === "group" && view.mode === "group" ? { collective: projectCollectiveReflection(view.experienceId, cardTemplateId, authority!.member.isAdmin, collective.find(row => row.cardTemplateId === cardTemplateId)) } : {}),
      accessEpoch: authority?.member.accessEpoch ?? null, adoptionRevision: authority?.experience.adoptionRevision ?? null,
      items: display.map(item => {
        const e = item.entry, mine = e.authorUserId === actor;
        const current = view.kind === "personal" ? e.source.kind === "personal" : e.source.kind === "group" && e.source.experienceId === view.experienceId;
        const membership = e.source.kind === "group" ? memberships.find(m => m.experienceId === (e.source as {experienceId:string}).experienceId) : null;
        const stillMember = Boolean(membership && (membership.isAdmin || membership.followerStatus === "active"));
        const canEdit = mine && current && (view.kind === "personal" || owner || authority!.member.isAdmin);
        return { ...item, canEdit, canDelete: mine && !item.empty, canHide: !mine && !!authority?.member.isAdmin && item.entry.groupVisible,
          explanation: canEdit || !mine ? null : e.source.kind === "personal" ? "To edit this reflection, open your Personal Card outside a Group Experience." : !stillMember
            ? "You can no longer edit this reflection because you are no longer a member of this Group."
            : e.source.kind === "group" && !originEditable.has(e.source.experienceId) ? "This reflection can no longer be edited in its original Group Experience."
            : "To edit this reflection, open it in its original Group Experience." };
      }) };
    return [cardTemplateId, feed];
  }));
}

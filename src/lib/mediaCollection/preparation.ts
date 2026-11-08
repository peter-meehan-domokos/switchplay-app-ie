import type { ClientSession } from "mongodb";
import type { CardRepository } from "../cards/repository";
import { nonblank, requireCondition } from "../cards/domain";
import { isMediaItem, type MediaItem } from "../media";
import { hash } from "../groupExperiences/contracts";
import { userKey } from "../groupExperiences/learningReads";
import { GROUP_MEDIA_COLLECTION } from "../groupExperiences/media/indexes";
import { compare, personalPipeline, type Order } from "./ownerHistory";
import { memberMediaCapabilities } from "./permissions";
import type { MediaCollectionItem, MediaCollectionPage } from "./contracts";
import type { GroupExperience, GroupMember } from "../groupExperiences/model";

type Authority = { experience: GroupExperience; member: GroupMember };
type Window = { _id: string; total: number; own?: number; items: Record<string, unknown>[] };
const orderFields = ["at", "kind", "source", "id", "rank", "index"];
export async function ownerPreviewPages(repo: CardRepository, actor: string, ids: string[], session: ClientSession, hasGroups: boolean, authority?: Authority) {
  if (authority) requireCondition(authority.member.userId === actor && authority.member.experienceId === authority.experience.experienceId, "GROUP_PERSPECTIVE_FORBIDDEN");
  const user = await repo.users().aggregate<{ username?: string; refs: { id: string; next?: string }[] }>([
    { $match: { _id: userKey(actor) } }, { $project: { _id: 0, username: 1, refs: { $map: { input: { $ifNull: ["$cardsData", []] }, as: "c", in: { id: "$$c.cardTemplateId", next: "$$c.historySourceCardTemplateId" } } } } },
  ], { session }).next();
  requireCondition(user, "MEDIA_FORBIDDEN");
  const targets = ids.map(card => {
    const sources: string[] = []; let next: string | undefined = card;
    while (next && !sources.includes(next)) {
      const matches = user.refs.filter(ref => ref.id === next);
      if (!matches.length) break;
      if (matches.length !== 1) { requireCondition(sources.length > 0, "AMBIGUOUS_PERSONAL_HISTORY_SOURCE"); break; }
      sources.push(next); next = nonblank(matches[0].next) ? matches[0].next : undefined;
    }
    return { card, sources };
  });
  const sources = [...new Set(targets.flatMap(target => target.sources))];
  const personal = !sources.length ? [] : await repo.users().aggregate<Window>(personalPipeline(actor, sources).concat([
    { $set: { targets: { $filter: { input: { $literal: targets }, as: "t", cond: { $in: ["$sourceId", "$$t.sources"] } } } } },
    { $unwind: "$targets" }, { $set: { rank: { $cond: [{ $eq: ["$at", ""] }, { $indexOfArray: ["$targets.sources", "$sourceId"] }, 0] } } },
    { $sort: { "targets.card": 1, ...Object.fromEntries(orderFields.map(field => [field, -1])) } },
    { $group: { _id: "$targets.card", total: { $sum: 1 }, items: { $firstN: { n: 5, input: "$$ROOT" } } } },
  ]), { session }).toArray();
  const group = hasGroups && ids.length ? await repo.db.collection(GROUP_MEDIA_COLLECTION).aggregate<Window>([
    { $match: { authorUserId: actor, cardTemplateId: { $in: ids }, state: "attached" } },
    { $sort: { uploadedAt: -1, contributionId: -1 } },
    { $group: { _id: "$cardTemplateId", total: { $sum: 1 }, items: { $firstN: { n: 5, input: { contributionId: "$contributionId", experienceId: "$experienceId", kind: "$kind", uploadedAt: "$uploadedAt", groupVisible: "$groupVisible", revision: "$revision", originalFilename: "$originalFilename" } } } } },
  ], { session }).toArray() : [];
  const origins = [...new Set(group.flatMap(window => window.items.map(item => item.experienceId as string)))];
  const names = origins.length ? await repo.db.collection<{ experienceId: string; name: string }>("groupExperiences").find({ experienceId: { $in: origins } }, { session, projection: { _id: 0, experienceId: 1, name: 1 } }).toArray() : [];
  return Object.fromEntries(ids.map(card => {
    const own = personal.find(window => window._id === card), shared = group.find(window => window._id === card);
    const rows: { order: Order; item: MediaCollectionItem }[] = (own?.items ?? []).flatMap(row => isMediaItem(row.media) ? [{ order: orderFields.map(field => row[field]) as Order, item: {
      source: { kind: "personal" as const, cardTemplateId: row.sourceId as string, mediaItemId: row.media.id }, authorUserId: actor, authorName: user.username?.trim() ? user.username : "Unknown user",
      mediaType: row.media.mediaType, description: row.media.description, originalFilename: row.media.originalFilename, uploadedAt: row.at as string || null, originName: "Personal", private: !!authority, media: row.media as MediaItem,
    } }] : []);
    for (const row of shared?.items ?? []) rows.push({ order: [(row.uploadedAt as Date).toISOString(), "group", "", row.contributionId as string, 0, 0], item: {
      source: { kind: "group", experienceId: row.experienceId as string, contributionId: row.contributionId as string }, authorUserId: actor, authorName: user.username?.trim() ? user.username : "Unknown user",
      mediaType: row.kind as "image" | "video", description: `Group ${row.kind}`, originalFilename: row.originalFilename as string | undefined, uploadedAt: (row.uploadedAt as Date).toISOString(), revision: row.revision as number,
      originName: names.find(name => name.experienceId === row.experienceId)?.name ?? null, private: !!authority && (authority.experience.experienceId !== row.experienceId || !row.groupVisible),
    } });
    const selected = rows.sort((a, b) => compare(b.order, a.order)).slice(0, 5).reverse(), total = (own?.total ?? 0) + (shared?.total ?? 0);
    const context = hash({ actor, cardTemplateId: card, experienceId: authority?.experience.experienceId ?? null });
    const encode = (order: Order, inclusive = false) => Buffer.from(JSON.stringify({ context, direction: "older", order, inclusive })).toString("base64url");
    const page: MediaCollectionPage = { viewerUserId: actor, cardTemplateId: card, items: selected.map(row => row.item), total, start: Math.max(0, total - selected.length), olderCount: Math.max(0, total - selected.length),
      older: total > selected.length && selected[0] ? encode(selected[0].order) : null, newer: null, refresh: selected.at(-1) ? encode(selected.at(-1)!.order, true) : null,
      capabilities: authority ? memberMediaCapabilities(authority.member, actor) : { canUpload: false, canRemoveOwn: true, canHideOthers: false, canManage: true },
      ...(authority ? { experienceId: authority.experience.experienceId, accessEpoch: authority.member.accessEpoch, adoptionRevision: authority.experience.adoptionRevision, structureRevision: authority.experience.structureRevision } : {}) };
    return [card, page];
  }));
}

export async function sharedPreviewPages(repo: CardRepository, actor: string, ids: string[], session: ClientSession, authority: Authority, subjectUserId?: string) {
  const experienceId = authority.experience.experienceId;
  requireCondition(authority.member.userId === actor && authority.member.experienceId === experienceId, "GROUP_PERSPECTIVE_FORBIDDEN");
  const windows = !ids.length ? [] : await repo.db.collection(GROUP_MEDIA_COLLECTION).aggregate<Window>([
    { $match: { experienceId, cardTemplateId: { $in: ids }, state: "attached", groupVisible: true, ...(subjectUserId ? { authorUserId: subjectUserId } : {}) } },
    { $sort: { uploadedAt: -1, contributionId: -1 } },
    { $group: { _id: "$cardTemplateId", total: { $sum: 1 }, own: { $sum: { $cond: [{ $eq: ["$authorUserId", actor] }, 1, 0] } }, items: { $firstN: { n: 5, input: { contributionId: "$contributionId", authorUserId: "$authorUserId", kind: "$kind", uploadedAt: "$uploadedAt", revision: "$revision", originalFilename: "$originalFilename" } } } } },
  ], { session }).toArray();
  const { creatorUsernames } = await import("../cards/creatorAttribution");
  const names = await creatorUsernames(repo, windows.flatMap(window => window.items.map(item => item.authorUserId as string)), session);
  return Object.fromEntries(ids.map(card => {
    const window = windows.find(window => window._id === card), items = window?.items ?? [], total = window?.total ?? 0;
    const key = hash({ actor, cardTemplateId: card, authority: { kind: "group", experienceId, ...(subjectUserId ? { subjectUserId } : {}) } });
    const encode = (row: Record<string, unknown>, inclusive = false) => JSON.stringify({ after: Buffer.from(JSON.stringify({ key, date: (row.uploadedAt as Date).toISOString(), id: row.contributionId, inclusive })).toString("base64url") });
    const page: MediaCollectionPage = { viewerUserId: actor, cardTemplateId: card, experienceId, accessEpoch: authority.member.accessEpoch, adoptionRevision: authority.experience.adoptionRevision, structureRevision: authority.experience.structureRevision,
      subjectUserId: subjectUserId ?? null, total, olderCount: Math.max(0, total - items.length), start: Math.max(0, total - items.length), older: total > items.length && items.at(-1) ? encode(items.at(-1)!) : null, newer: null, refresh: items[0] ? encode(items[0], true) : null,
      capabilities: memberMediaCapabilities(authority.member, subjectUserId, !!window?.own),
      items: [...items].reverse().map(row => ({ source: { kind: "group", experienceId, contributionId: row.contributionId as string }, authorUserId: row.authorUserId as string, authorName: names.get(row.authorUserId as string) ?? "Unknown user", mediaType: row.kind as "image" | "video", description: `Group ${row.kind}`, originalFilename: row.originalFilename as string | undefined, uploadedAt: (row.uploadedAt as Date).toISOString(), revision: row.revision as number, originName: authority.experience.name, private: false })) };
    return [card, page];
  }));
}

import type { Filter } from "mongodb";
import { requireCondition } from "../../cards/domain";
import { hash, id } from "../contracts";
import type { GroupMediaRepository } from "./repository";
import type { GroupMediaRecord, MediaAuthority } from "./model";
export async function readMediaPage(repo: GroupMediaRepository, actor: string, cardTemplateId: string, authority: MediaAuthority, options: { after?: string; before?: string; limit?: number }) {
  id(actor); id(cardTemplateId);
  const limit = options.limit ?? 30;
  requireCondition(Number.isSafeInteger(limit) && limit > 0 && limit <= 30, "INVALID_GROUP_MEDIA_PAGE");
  const key = hash({ actor, cardTemplateId, authority });
  requireCondition(!(options.after && options.before), "INVALID_GROUP_MEDIA_PAGE");
  const sign = options.before ? 1 : -1, value = options.before ?? options.after;
  let older: Filter<GroupMediaRecord> = {};
  if (value !== undefined) {
    requireCondition(value.length <= 2048, "INVALID_GROUP_MEDIA_PAGE");
    let cursor;
    try { cursor = JSON.parse(Buffer.from(value, "base64url").toString()); } catch { requireCondition(false, "INVALID_GROUP_MEDIA_PAGE"); }
    requireCondition((cursor?.inclusive === undefined || typeof cursor.inclusive === "boolean") && cursor?.key === key && typeof cursor.date === "string" && Number.isFinite(Date.parse(cursor.date)) && typeof cursor.id === "string", "INVALID_GROUP_MEDIA_PAGE");
    id(cursor.id);
    const cmp = sign === 1 ? "$gt" : "$lt", idCmp = cursor.inclusive ? (sign === 1 ? "$gte" : "$lte") : cmp;
    older = { $or: [{ uploadedAt: { [cmp]: new Date(cursor.date) } }, { uploadedAt: new Date(cursor.date), contributionId: { [idCmp]: cursor.id } }] };
  }
  return repo.transaction(async session => {
    const context = authority.kind === "owner" ? { viewerUserId: actor, cardTemplateId, kind: "owner" as const }
      : { ...await repo.groupAuthority(actor, authority.experienceId, cardTemplateId, session, authority.subjectUserId),
        kind: "group" as const, subjectUserId: authority.subjectUserId ?? null };
    const filter: Filter<GroupMediaRecord> = { cardTemplateId, state: "attached", ...(authority.kind === "owner" ? { authorUserId: actor }
      : { experienceId: authority.experienceId, groupVisible: true, ...(authority.subjectUserId ? { authorUserId: authority.subjectUserId } : {}) }) };
    const rows = await repo.records().find({ ...filter, ...older }, { session, projection: { _id: 0, contributionId: 1, authorUserId: 1,
      experienceId: 1, cardTemplateId: 1, kind: 1, uploadedAt: 1, revision: 1, groupVisible: 1 } })
      .sort({ uploadedAt: sign, contributionId: sign }).limit(limit + 1).toArray();
    const total = await repo.records().countDocuments(filter, { session });
    const page = rows.slice(0, limit); if (sign === 1) page.reverse();
    const last = page.at(-1), first = page[0];
    const encode = (row: GroupMediaRecord, inclusive = false) => Buffer.from(JSON.stringify({ key, date: row.uploadedAt!.toISOString(), id: row.contributionId, inclusive })).toString("base64url");
    // One bounded identity lookup, never membership checks or one query per origin.
    const origins = await repo.groups.experiences().find({ experienceId: { $in: [...new Set(page.map(r => r.experienceId))] } },
      { session, projection: { _id: 0, experienceId: 1, name: 1 } }).toArray();
    const start = last ? await repo.records().countDocuments({ ...filter, $or: [{ uploadedAt: { $lt: last.uploadedAt } },
      { uploadedAt: last.uploadedAt, contributionId: { $lt: last.contributionId } }] }, { session }) : 0;
    return { ...context, total, start, refresh: first ? encode(first, true) : null, previous: first && start + page.length < total ? encode(first) : null, items: page.map(row => ({ ...repo.dto(row), originName: origins.find(g => g.experienceId === row.experienceId)?.name ?? null,
      sourceKind: "group-contribution" as const,
      deliveryUrl: `/api/group-media/${encodeURIComponent(row.contributionId)}?action=playback${authority.kind === "owner" ? "" : `&experienceId=${encodeURIComponent(authority.experienceId)}${authority.subjectUserId ? `&subjectUserId=${encodeURIComponent(authority.subjectUserId)}` : ""}`}` })),
      next: start > 0 && last ? encode(last) : null };
  });
}

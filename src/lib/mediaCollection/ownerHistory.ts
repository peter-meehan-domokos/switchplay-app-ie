import { memberMediaCapabilities, type MediaCapabilities } from "./permissions";
import type { Document } from "mongodb";
import type { CardRepository } from "../cards/repository";
import { requireCondition, nonblank } from "../cards/domain";
import { isMediaItem, type MediaItem } from "../media";
import { id, hash } from "../groupExperiences/contracts";
import { userKey } from "../groupExperiences/learningReads";
import { GroupExperienceRepository } from "../groupExperiences/repository";
import { selectedCard } from "../groupExperiences/publicVersions";
import { GROUP_MEDIA_COLLECTION, assertGroupMediaIndexes } from "../groupExperiences/media/indexes";
import type { GroupMediaRecord } from "../groupExperiences/media/model";
import type { MediaCollectionItem, MediaCollectionPage } from "./contracts";

type Order = [string, string, string, string, number, number];
type Row = { order: Order; item: MediaCollectionItem };
type Cursor = { context: string; direction: "older" | "newer"; order: Order; inclusive?: boolean };
const compare = (a: Order, b: Order) => { for (let i = 0; i < a.length; i++) { if (typeof a[i] === "string" && typeof b[i] === "string") { const value = Buffer.compare(Buffer.from(a[i] as string), Buffer.from(b[i] as string)); if (value) return value; } else { if (a[i] < b[i]) return -1; if (a[i] > b[i]) return 1; } } return 0; };
const sortFields = ["at", "kind", "source", "id", "rank", "index"];
const tuple = sortFields.map(k => `$${k}`);
// Evaluate only scalar media metadata. Do not project reflection/tests/Info or
// transfer the complete media array to Node in order to find a page.
const string = (field: string) => ({ $cond: [{ $eq: [{ $type: field }, "string"] }, { $gt: [{ $strLenCP: { $trim: { input: field } } }, 0] }, false] });
function personalPipeline(actor: string, sources: string[]): Document[] {
  const item = "$cardsData.mediaItems";
  return [
    { $match: { _id: userKey(actor) } }, { $project: { cardsData: { $filter: { input: "$cardsData", as: "card", cond: { $in: ["$$card.cardTemplateId", { $literal: sources }] } } } } },
    { $unwind: "$cardsData" }, { $match: { $expr: { $isArray: "$cardsData.mediaItems" } } }, { $unwind: { path: "$cardsData.mediaItems", includeArrayIndex: "position" } },
    { $match: { $expr: { $and: [string(`${item}.id`), string(`${item}.description`), string(`${item}.src`),
      { $or: [{ $and: [{ $eq: [`${item}.mediaType`, "image"] }, { $or: [{ $eq: [{ $type: `${item}.provider` }, "missing"] }, { $and: [{ $eq: [`${item}.provider`, "cloudflare-r2"] }, string(`${item}.assetId`)] }] }] },
        { $and: [{ $eq: [`${item}.mediaType`, "video"] }, { $in: [`${item}.provider`, ["cloudflare-stream", "youtube"]] }, string(`${item}.assetId`),
          { $or: [{ $eq: [{ $type: `${item}.thumbnailSrc` }, "missing"] }, { $eq: [{ $type: `${item}.thumbnailSrc` }, "string"] }] },
          ...["width", "height"].map(k => ({ $or: [{ $eq: [`${item}.provider`, "youtube"] },{ $eq: [{ $type: `${item}.${k}` }, "missing"] }, { $and: [{ $in: [{ $type: `${item}.${k}` }, ["int", "long", "double"]] }, { $gt: [`${item}.${k}`, 0] }, { $lte: [`${item}.${k}`, Number.MAX_VALUE] }] }] }))] }] }] } } },
    // Existing repair semantics keep the first valid occurrence of a duplicate ID.
    { $sort: { position: 1 } }, { $group: { _id: { source: "$cardsData.cardTemplateId", id: `${item}.id` }, media: { $first: Object.fromEntries(["id", "description", "mediaType", "provider", "assetId", "src", "thumbnailSrc", "width", "height", "uploadedAt", "originalFilename"].map(k => [k, `${item}.${k}`])) }, index: { $first: "$position" } } },
    { $set: { date: { $convert: { input: { $cond: [{ $in: [{ $type: "$media.uploadedAt" }, ["string", "date"]] }, "$media.uploadedAt", null] }, to: "date", onError: null, onNull: null } } } },
    { $project: { _id: 0, media: 1, at: { $cond: ["$date", { $dateToString: { date: "$date", format: "%Y-%m-%dT%H:%M:%S.%LZ" } }, ""] },
      kind: { $cond: ["$date", "personal", ""] }, source: { $cond: ["$date", "$_id.source", ""] }, id: { $cond: ["$date", "$_id.id", ""] },
      sourceId: "$_id.source", rank: { $cond: ["$date", 0, { $indexOfArray: [{ $literal: sources }, "$_id.source"] }] }, index: { $cond: ["$date", 0, "$index"] } } },
  ];
}
function cursor(input: string | undefined, context: string): Cursor | undefined {
  if (!input) return;
  let value; try { requireCondition(input.length < 4096, "INVALID_MEDIA_CURSOR"); value = JSON.parse(Buffer.from(input, "base64url").toString()); } catch { requireCondition(false, "INVALID_MEDIA_CURSOR"); }
  requireCondition((value.inclusive === undefined || typeof value.inclusive === "boolean") && value.context === context && ["older", "newer"].includes(value.direction) && Array.isArray(value.order) && value.order.length === 6
    && value.order.slice(0, 4).every((v: unknown) => typeof v === "string" && v.length <= 500)
    && value.order.slice(4).every((v: unknown) => Number.isSafeInteger(v) && Number(v) >= 0), "INVALID_MEDIA_CURSOR");
  return value;
}
export async function readOwnerMediaPage(cards: CardRepository, actor: string, cardTemplateId: string,
  options: { limit?: number; cursor?: string; experienceId?: string } = {}): Promise<MediaCollectionPage> {
  id(actor); id(cardTemplateId); if (options.experienceId !== undefined) id(options.experienceId);
  const limit = options.limit ?? 30; requireCondition(Number.isSafeInteger(limit) && limit > 0 && limit <= 30, "INVALID_MEDIA_PAGE");
  const context = hash({ actor, cardTemplateId, experienceId: options.experienceId ?? null }), after = cursor(options.cursor, context);
  const hasGroups = await cards.db.listCollections({ name: GROUP_MEDIA_COLLECTION }, { nameOnly: true }).hasNext();
  if (hasGroups) await assertGroupMediaIndexes(cards.db);
  return cards.transaction(async session => {
    let authority = {};
    let capabilities: MediaCapabilities = { canUpload: false, canRemoveOwn: true, canHideOthers: false, canManage: true };
    if (options.experienceId) {
      const groups = new GroupExperienceRepository(cards), access = await groups.access(actor, options.experienceId, "member", session);
      await selectedCard(cards, access.experience, cardTemplateId, session);
      capabilities = memberMediaCapabilities(access.member, actor);
      authority = { experienceId: options.experienceId, accessEpoch: access.member.accessEpoch,
        adoptionRevision: access.experience.adoptionRevision, structureRevision: access.experience.structureRevision };
    }
    // Minimal lineage only; unrelated personal content never leaves MongoDB.
    const user = await cards.users().aggregate<{ username?: string; refs: { id: string; next?: string }[] }>([
      { $match: { _id: userKey(actor) } }, { $project: { _id: 0, username: 1, refs: { $map: { input: { $ifNull: ["$cardsData", []] }, as: "c", in: { id: "$$c.cardTemplateId", next: "$$c.historySourceCardTemplateId" } } } } },
    ], { session }).next();
    requireCondition(user, "MEDIA_FORBIDDEN");
    const sources: string[] = []; let next: string | undefined = cardTemplateId;
    while (next && !sources.includes(next)) {
      const matches = user.refs.filter(r => r.id === next);
      if (!matches.length) break;
      if (matches.length !== 1) { requireCondition(sources.length > 0, "AMBIGUOUS_PERSONAL_HISTORY_SOURCE"); break; }
      sources.push(next); next = nonblank(matches[0].next) ? matches[0].next : undefined;
    }
    const pipeline = personalPipeline(actor, sources), groups = cards.db.collection<GroupMediaRecord>(GROUP_MEDIA_COLLECTION);
    const baseGroup = { authorUserId: actor, cardTemplateId, state: "attached" as const };
    const get = async (direction: "older" | "newer", boundary: Order | undefined, count: number, inclusive = false): Promise<Row[]> => {
      const sign = direction === "older" ? -1 : 1;
      const personal = sources.length ? await cards.users().aggregate(pipeline.concat(
        boundary ? [{ $match: { $expr: { [direction === "older" ? (inclusive ? "$lte" : "$lt") : (inclusive ? "$gte" : "$gt")]: [tuple, { $literal: boundary }] } } }] : [],
        [{ $sort: Object.fromEntries(sortFields.map(k => [k, sign])) }, { $limit: count }]), { session }).toArray() : [];
      const rows: Row[] = personal.flatMap(p => isMediaItem(p.media) ? [{ order: sortFields.map(k => p[k]) as Order, item: {
        source: { kind: "personal" as const, cardTemplateId: p.sourceId, mediaItemId: p.media.id }, authorUserId: actor, mediaType: p.media.mediaType,
        description: p.media.description, originalFilename: p.media.originalFilename, uploadedAt: p.at || null, originName: "Personal", private: Boolean(options.experienceId), media: p.media as MediaItem } }] : []);
      if (hasGroups) {
        // Date/ID range and sort are backed by the author/Card chronological index.
        let range: Document = {};
        if (boundary) {
          if (!boundary[0]) range = direction === "older" ? { uploadedAt: { $lt: new Date(0) } } : {};
          else {
            const date = new Date(boundary[0]); requireCondition(Number.isFinite(date.getTime()), "INVALID_MEDIA_CURSOR");
            const cmp = direction === "older" ? "$lt" : "$gt";
            const idCmp = inclusive ? (direction === "older" ? "$lte" : "$gte") : cmp;
            const equal = boundary[1] === "group" ? { uploadedAt: date, contributionId: { [idCmp]: boundary[3] } }
              : (direction === "older" ? boundary[1] > "group" : boundary[1] < "group") ? { uploadedAt: date } : null;
            range = { $or: [{ uploadedAt: { [cmp]: date } }, ...(equal ? [equal] : [])] };
          }
        }
        const result = await groups.find({ ...baseGroup, ...range }, { session, projection: { _id: 0, contributionId: 1, experienceId: 1, kind: 1, originalFilename: 1, uploadedAt: 1, groupVisible: 1, revision: 1 } })
          .sort({ uploadedAt: sign, contributionId: sign }).limit(count).toArray();
        for (const g of result) rows.push({ order: [g.uploadedAt!.toISOString(), "group", "", g.contributionId, 0, 0], item: {
          source: { kind: "group", experienceId: g.experienceId, contributionId: g.contributionId }, authorUserId: actor, mediaType: g.kind,
          description: `Group ${g.kind}`, originalFilename: g.originalFilename, uploadedAt: g.uploadedAt!.toISOString(), originName: null, revision: g.revision,
          private: Boolean(options.experienceId && (options.experienceId !== g.experienceId || !g.groupVisible)) } });
      }
      return rows.sort((a, b) => sign * compare(a.order, b.order)).slice(0, count);
    };
    const found = await get(after?.direction ?? "older", after?.order, limit, after?.inclusive);
    const rows = found.sort((a, b) => compare(a.order, b.order));
    const personalCount = sources.length ? (await cards.users().aggregate(pipeline.concat([{ $count: "total" }]), { session }).next())?.total ?? 0 : 0;
    const total = personalCount + (hasGroups ? await groups.countDocuments(baseGroup, { session }) : 0);
    const origins = [...new Set(rows.flatMap(r => r.item.source.kind === "group" ? [r.item.source.experienceId] : []))];
    const names = origins.length ? await cards.db.collection<{ experienceId: string; name: string }>("groupExperiences").find({ experienceId: { $in: origins } }, { session, projection: { _id: 0, experienceId: 1, name: 1 } }).toArray() : [];
    for (const row of rows) row.item.authorName = typeof user.username === "string" && user.username.trim() ? user.username : "Unknown user";
    for (const row of rows) if (row.item.source.kind === "group") row.item.originName = names.find(g => g.experienceId === (row.item.source as { experienceId: string }).experienceId)?.name ?? null;
    let start = 0;
    if (rows[0]) {
      const boundary = rows[0].order;
      const personalBefore = sources.length ? (await cards.users().aggregate(pipeline.concat([{ $match: { $expr: { $lt: [tuple, { $literal: boundary }] } } }, { $count: "total" }]), { session }).next())?.total ?? 0 : 0;
      const groupBefore = !hasGroups || !boundary[0] ? 0 : await groups.countDocuments({ ...baseGroup, $or: [{ uploadedAt: { $lt: new Date(boundary[0]) } },
        ...(boundary[1] === "personal" ? [{ uploadedAt: new Date(boundary[0]) }] : [{ uploadedAt: new Date(boundary[0]), contributionId: { $lt: boundary[3] } }])] }, { session });
      start = personalBefore + groupBefore;
    }
    const encode = (direction: Cursor["direction"], order: Order, inclusive = false) => Buffer.from(JSON.stringify({ context, direction, order, inclusive })).toString("base64url");
    return { viewerUserId: actor, cardTemplateId, ...authority, capabilities, start, refresh: rows.at(-1) ? encode("older", rows.at(-1)!.order, true) : null, items: rows.map(r => r.item), total, olderCount: Math.max(0, total - rows.length),
      older: rows[0] && (await get("older", rows[0].order, 1)).length ? encode("older", rows[0].order) : null,
      newer: rows.at(-1) && (await get("newer", rows.at(-1)!.order, 1)).length ? encode("newer", rows.at(-1)!.order) : null };
  });
}

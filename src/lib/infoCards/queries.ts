import type { ClientSession, Document } from "mongodb";
import { CardRepository } from "../cards/repository";
import { creatorUsernames, UNKNOWN_CREATOR } from "../cards/creatorAttribution";
import { CardArchitectureError, isRecord, requireCondition } from "../cards/domain";
import { INFO_COLLECTIONS, type InfoCardRepository } from "./repository";
import { assertInfoDraft, infoId, infoReferences, seriesName, visibility } from "./domain";
import { measureInfoCapacity } from "./capacity";
import type { InfoConsultationEntry, InfoConsultationSnapshot, MainInfoContext, InfoPublication, InfoRoot, InfoSeries, PublishedInfo } from "./model";

export type InfoQuery = { search?: string; offset?: number; limit?: number; seriesId?: string };
export async function infoEditor(repo: InfoCardRepository, actor: string, id: string) {
  return repo.transaction(async session => {
    const root = await repo.owner(actor, id, session);
    const publication = root.latestVersion ? await repo.versions().findOne({ infoCardId: id, version: root.latestVersion }, { session, projection: { _id: 0 } }) : null;
    const selected = root.draft?.seriesId ?? (root.draft === null ? publication?.content.seriesId : null);
    const series = selected ? await repo.series().findOne({ seriesId: selected }, { session, projection: { _id: 0 } }) : null;
    const names = await creatorUsernames(new CardRepository(repo.db, repo.client), series ? [series.createdByUserId] : [], session);
    return { root, publication, selectedSeries: series ? { seriesId: series.seriesId, title: series.title,
      createdByUserId: series.createdByUserId, creatorUsername: names.get(series.createdByUserId) ?? UNKNOWN_CREATOR } : null };
  });
}
function page(query: InfoQuery) {
  const { search = "", offset = 0, limit = 30 } = query;
  requireCondition(typeof search === "string" && search.length <= 200 && Number.isSafeInteger(offset) && offset >= 0
    && Number.isSafeInteger(limit) && limit > 0 && limit <= 50, "INVALID_INFO_QUERY");
  if (query.seriesId !== undefined) infoId(query.seriesId);
  return { search: search.normalize("NFKC").trim(), offset, limit };
}
const literal = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
type Joined = InfoRoot & { publication: InfoPublication; series: InfoSeries };

async function decorate(repo: InfoCardRepository, rows: Joined[], session: ClientSession): Promise<PublishedInfo[]> {
  const names = await creatorUsernames(new CardRepository(repo.db, repo.client), rows.flatMap(r => [r.ownerUserId, r.series.createdByUserId]), session);
  return rows.map(r => ({ infoCardId: r.infoCardId, version: r.publication.version, visibility: r.publication.visibility,
    content: r.publication.content, ownerUserId: r.ownerUserId, creatorUsername: names.get(r.ownerUserId) ?? UNKNOWN_CREATOR,
    series: { seriesId: r.series.seriesId, title: r.series.title, createdByUserId: r.series.createdByUserId,
      creatorUsername: names.get(r.series.createdByUserId) ?? UNKNOWN_CREATOR } }));
}
function latestJoin(): Document[] {
  return [
    { $lookup: { from: INFO_COLLECTIONS.versions, let: { id: "$infoCardId", version: "$latestVersion" }, pipeline: [
      { $match: { $expr: { $and: [{ $eq: ["$infoCardId", "$$id"] }, { $eq: ["$version", "$$version"] }] } } },
    ], as: "publication" } }, { $unwind: "$publication" },
    { $lookup: { from: INFO_COLLECTIONS.series, localField: "publication.content.seriesId", foreignField: "seriesId", as: "series" } }, { $unwind: "$series" },
  ];
}
function access(actor: string) {
  return { $or: [{ ownerUserId: actor }, { visibility: "public", "publication.visibility": "public" }] };
}
// Called only by backend code with authorised main-context references in Phase 4.
// No HTTP endpoint accepts a list and treats it as attachment authority.
export async function publishedSnapshot(repo: InfoCardRepository, actor: string, ids: unknown, session?: ClientSession): Promise<PublishedInfo[]> {
  const entries = await publicationSnapshotEntries(repo, actor, ids, session);
  requireCondition(entries.every(entry => entry.status === "available"), "INFO_PUBLICATION_FORBIDDEN");
  return entries.map(entry => { requireCondition(entry.status === "available", "INFO_PUBLICATION_FORBIDDEN"); return entry.info; });
}

function validPublication(row: Joined) {
  // Only row-local validation is isolated. Database/attribution failures below
  // must remain whole-request failures, not disguised as unavailable cards.
  try {
    requireCondition(isRecord(row.publication) && isRecord(row.series), "INVALID_INFO_PUBLICATION");
    infoId(row.infoCardId); infoId(row.ownerUserId); visibility(row.visibility);
    const publication = row.publication, series = row.series;
    requireCondition(!row.deletedAt && Number.isSafeInteger(row.latestVersion) && row.latestVersion > 0
      && publication.infoCardId === row.infoCardId && publication.version === row.latestVersion
      && publication.visibility === row.visibility && publication.publishedByUserId === row.ownerUserId
      && publication.publishedAt instanceof Date && Number.isFinite(publication.publishedAt.getTime())
      && Number.isSafeInteger(publication.sourceRevision) && publication.sourceRevision >= 0, "INVALID_INFO_PUBLICATION");
    assertInfoDraft(publication.content);
    infoId(publication.content.seriesId); infoId(series.seriesId); infoId(series.createdByUserId);
    requireCondition(series.seriesId === publication.content.seriesId && seriesName(series.title).title === series.title, "INVALID_INFO_PUBLICATION");
    // Mathematical publications need no geometry certificate. Historical
    // acceptance metadata remains readable; legacy plain-text rules stay intact.
    if (!publication.content.bodyFormat) requireCondition(measureInfoCapacity({ title: publication.content.title, body: publication.content.body,
      seriesTitle: series.title, hasMedia: publication.content.mediaItem !== null }).fits, "INVALID_INFO_PUBLICATION");
    return true;
  } catch (error) {
    if (!(error instanceof CardArchitectureError)) throw error;
    return false;
  }
}

// Same resolution machinery as strict catalogue publication reads, but preserves
// authorised main-reference positions without exposing why a slot is unavailable.
export async function publicationSnapshotEntries(repo: InfoCardRepository, actor: string, ids: unknown, session?: ClientSession): Promise<InfoConsultationEntry[]> {
  infoId(actor); const ordered = infoReferences(ids);
  const read = async (snapshot: ClientSession): Promise<InfoConsultationEntry[]> => {
    const rows = await repo.roots().aggregate<Joined>([
      { $match: { infoCardId: { $in: ordered }, latestVersion: { $gt: 0 }, $or: [{ ownerUserId: actor }, { visibility: "public" }] } },
      ...latestJoin(), { $match: access(actor) },
    ], { session: snapshot }).toArray();
    const items = await decorate(repo, rows.filter(validPublication), snapshot), byId = new Map(items.map(item => [item.infoCardId, item]));
    return ordered.map(id => { const info = byId.get(id); return info ? { status: "available", info } : { status: "unavailable" }; });
  };
  if (session) { requireCondition(session.inTransaction(), "INFO_TRANSACTION_REQUIRED"); return read(session); }
  return repo.transaction(read);
}

export async function mainInfoConsultation(repo: InfoCardRepository, actor: string, mainCardId: string, context: MainInfoContext): Promise<InfoConsultationSnapshot> {
  const main = new CardRepository(repo.db, repo.client);
  return repo.transaction(async session => {
    const version = await main.consultationCardVersion(actor, mainCardId, context, session);
    return { mainCardId, mainCardVersion: version.version,
      entries: await publicationSnapshotEntries(repo, actor, version.content.infoCardIds, session) };
  });
}

export async function infoCatalogue(repo: InfoCardRepository, actor: string, query: InfoQuery = {}) {
  infoId(actor); const { search, offset, limit } = page(query);
  return repo.transaction(async session => {
    // ACL filters precede every group/count/search/pagination operation.
    const pipeline: Document[] = [{ $match: { latestVersion: { $gt: 0 }, $or: [{ ownerUserId: actor }, { visibility: "public" }] } },
      ...latestJoin(), { $match: access(actor) }];
    if (query.seriesId) pipeline.push({ $match: { "series.seriesId": query.seriesId } });
    // User lookup projects usernames only, never account/contact metadata.
    for (const [field, name] of [["ownerUserId", "creator"], ["series.createdByUserId", "seriesCreator"]]) pipeline.push({ $lookup: {
      from: "users", let: { id: `$${field}` }, pipeline: [{ $match: { $expr: { $eq: [{ $toString: "$_id" }, "$$id"] } } }, { $project: { _id: 0, username: 1 } }], as: name,
    } });
    if (search) pipeline.push({ $match: { $or: ["publication.content.title", "series.title", "creator.username", "seriesCreator.username"].map(field => ({ [field]: { $regex: literal(search), $options: "i" } })) } });
    // Latest successful immutable publication, never draft/root modification or
    // creation time. The full ownership/order key precedes pagination.
    pipeline.push({ $set: { own: { $cond: [{ $eq: ["$ownerUserId", actor] }, 0, 1] } } },
      { $sort: { own: 1, "publication.publishedAt": -1, infoCardId: 1 } }, { $skip: offset }, { $limit: limit + 1 });
    const rows = await repo.roots().aggregate<Joined>(pipeline, { session }).toArray();
    return { items: await decorate(repo, rows.slice(0, limit), session), nextOffset: rows.length > limit ? offset + limit : null };
  });
}

export async function discoverSeries(repo: InfoCardRepository, actor: string, query: InfoQuery = {}) {
  infoId(actor); const { search, offset, limit } = page(query);
  return repo.transaction(async session => {
    const pipeline: Document[] = [];
    if (search) pipeline.push({ $match: { normalisedTitle: { $regex: literal(search.toLowerCase()) } } });
    pipeline.push({ $lookup: { from: INFO_COLLECTIONS.versions, let: { id: "$seriesId" }, pipeline: [
      { $match: { visibility: "public", $expr: { $eq: ["$content.seriesId", "$$id"] } } },
      { $lookup: { from: INFO_COLLECTIONS.roots, let: { id: "$infoCardId", version: "$version" }, pipeline: [
        { $match: { visibility: "public", $expr: { $and: [{ $eq: ["$infoCardId", "$$id"] }, { $eq: ["$latestVersion", "$$version"] }] } } }, { $project: { _id: 1 } },
      ], as: "root" } }, { $match: { "root.0": { $exists: true } } }, { $limit: 1 }, { $project: { _id: 1 } },
    ], as: "publicMember" } },
    { $match: { $or: [{ createdByUserId: actor }, { "publicMember.0": { $exists: true } }] } },
    { $set: { own: { $cond: [{ $eq: ["$createdByUserId", actor] }, 0, 1] } } },
    { $sort: { own: 1, normalisedTitle: 1, seriesId: 1 } }, { $skip: offset }, { $limit: limit + 1 });
    const rows = await repo.series().aggregate<InfoSeries>(pipeline, { session }).toArray();
    const names = await creatorUsernames(new CardRepository(repo.db, repo.client), rows.slice(0, limit).map(r => r.createdByUserId), session);
    return { items: rows.slice(0, limit).map(r => ({ seriesId: r.seriesId, title: r.title, createdByUserId: r.createdByUserId,
      creatorUsername: names.get(r.createdByUserId) ?? UNKNOWN_CREATOR })), nextOffset: rows.length > limit ? offset + limit : null };
  });
}

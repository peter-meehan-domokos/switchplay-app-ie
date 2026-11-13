import type { ClientSession, Document } from "mongodb";
import { createHmac } from "node:crypto";
import { CardRepository } from "../cards/repository";
import { creatorUsernames, UNKNOWN_CREATOR } from "../cards/creatorAttribution";
import { CardArchitectureError, isRecord, requireCondition } from "../cards/domain";
import { INFO_COLLECTIONS, type InfoCardRepository } from "./repository";
import { assertInfoDraft, infoId, infoReferences, seriesName, visibility } from "./domain";
import { measureInfoCapacity } from "./capacity";
import type { InfoConsultationEntry, InfoConsultationSnapshot, MainInfoContext, InfoPublication, InfoRoot, InfoSeries, PublishedInfo } from "./model";
import { CREATOR_INFO_FILTER, isCreatorInfo, isPersonalInfo } from "./model";
import { personalHistorySegments } from "../cards/forks";

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
// Owner unfinished-work recovery only. Reuse real working membership and the
// existing actor history; a URL/origin cannot grant access to a parent/fork.
export async function personalRecoveryContext(repo: InfoCardRepository, actor: string, root: InfoRoot) {
  requireCondition(root.ownerUserId === actor && isPersonalInfo(root), "INFO_FORBIDDEN");
  return repo.transaction(async session => {
    const main = new CardRepository(repo.db, repo.client), user = await main.getPersonalUser(actor, session);
    if (!user) return null;
    for (const membership of user.decksData.filter(data => data.archivedAt === null).sort((a, b) => a.deckTemplateId.localeCompare(b.deckTemplateId))) {
      const deck = await main.getDeckVersion(membership.deckTemplateId, membership.deckTemplateVersion, session);
      if (!deck) continue;
      for (const ref of deck.content.cards) {
        const data = user.cardsData.filter(data => data.cardTemplateId === ref.cardTemplateId);
        if (data.length !== 1 || root.latestVersion === 0 && ref.cardTemplateId !== root.originCardTemplateId) continue;
        if (!personalHistorySegments(user.cardsData, ref.cardTemplateId).some(source => source.cardTemplateId === root.originCardTemplateId)) continue;
        try {
          await main.consultationCardVersion(actor, ref.cardTemplateId, { mode: "working", version: data[0].cardTemplateVersion, deckTemplateId: membership.deckTemplateId }, session);
          return { deckTemplateId: membership.deckTemplateId, cardTemplateId: ref.cardTemplateId };
        } catch (error) { if (!(error instanceof CardArchitectureError)) throw error; }
      }
    }
    return null;
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
    ...(isPersonalInfo(r) ? { kind: "personal" as const, originCardTemplateId: r.originCardTemplateId } : {}),
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
export async function publicationSnapshotEntries(repo: InfoCardRepository, actor: string, ids: unknown, session?: ClientSession,
  personalOrigins?: ReadonlyMap<string, ReadonlySet<string>>): Promise<InfoConsultationEntry[]> {
  infoId(actor); const ordered = infoReferences(ids);
  const read = async (snapshot: ClientSession): Promise<InfoConsultationEntry[]> => {
    const rows = await repo.roots().aggregate<Joined>([
      { $match: { infoCardId: { $in: ordered }, latestVersion: { $gt: 0 }, $or: [{ ownerUserId: actor }, { visibility: "public" }] } },
      ...latestJoin(), { $match: access(actor) },
    ], { session: snapshot }).toArray();
    const permitted = rows.filter(row => isCreatorInfo(row) || isPersonalInfo(row) && row.ownerUserId === actor
      && row.visibility === "private" && row.publication.visibility === "private"
      && personalOrigins?.get(row.infoCardId)?.has(row.originCardTemplateId!));
    const items = await decorate(repo, permitted.filter(validPublication), snapshot), byId = new Map(items.map(item => [item.infoCardId, item]));
    return ordered.map(id => { const info = byId.get(id); return info ? { status: "available", info } : { status: "unavailable" }; });
  };
  if (session) { requireCondition(session.inTransaction(), "INFO_TRANSACTION_REQUIRED"); return read(session); }
  return repo.transaction(read);
}

export async function mainInfoConsultation(repo: InfoCardRepository, actor: string, mainCardId: string, context: MainInfoContext): Promise<InfoConsultationSnapshot> {
  const main = new CardRepository(repo.db, repo.client);
  return repo.transaction(async session => {
    const version = await main.consultationCardVersion(actor, mainCardId, context, session);
    type Ref = { id: string; source: "shared" | "personal"; origin?: string; date?: string };
    const refs: Ref[] = infoReferences(version.content.infoCardIds).map(id => ({ id, source: "shared", date: version.content.infoCardAttachedAt?.[id] }));
    const origins = new Map<string, Set<string>>();
    let sources: { cardTemplateId: string; personalInfoRevision: number }[] | undefined;
    if (context.mode === "working") {
      const user = await main.getPersonalUser(actor, session);
      requireCondition(user?.cardsData.filter(data => data.cardTemplateId === mainCardId).length === 1, "AMBIGUOUS_CARD_DATA");
      infoReferences(user.cardsData.find(data => data.cardTemplateId === mainCardId)!.personalInfoCardIds);
      const segments = personalHistorySegments(user.cardsData, mainCardId);
      sources = segments.map(segment => ({ cardTemplateId: segment.cardTemplateId, personalInfoRevision: segment.personalInfoRevision ?? 0 }));
      for (const segment of segments) for (const id of segment.personalInfoCardIds ?? []) {
        const allowed = origins.get(id) ?? new Set<string>(); allowed.add(segment.cardTemplateId); origins.set(id, allowed);
        refs.push({ id, source: "personal", origin: segment.cardTemplateId, date: segment.personalInfoCardAttachedAt?.[id] });
      }
    }
    const ids = [...new Set(refs.map(ref => ref.id))];
    const resolved = await publicationSnapshotEntries(repo, actor, ids, session, origins);
    const byId = new Map(ids.map((id, index) => [id, resolved[index]]));
    const availableIds = resolved.flatMap(entry => entry.status === "available" ? [entry.info.infoCardId] : []);
    const roots = availableIds.length ? await repo.roots().find({ infoCardId: { $in: availableIds } },
      { session, projection: { infoCardId: 1, createdAt: 1 } }).toArray() : [];
    const dates = new Map(roots.map(root => [root.infoCardId, root.createdAt]));
    const seen = new Set<string>();
    const entries = refs.flatMap(ref => {
      const found = byId.get(ref.id);
      const available = found?.status === "available" && (ref.source === "shared" ? found.info.kind !== "personal"
        : found.info.kind === "personal" && found.info.originCardTemplateId === ref.origin);
      if (available && seen.has(ref.id)) return [];
      if (available) seen.add(ref.id);
      const createdAt = available ? dates.get(ref.id) : undefined;
      const rawDate = ref.date ?? (createdAt instanceof Date && Number.isFinite(createdAt.getTime()) ? createdAt.toISOString() : undefined);
      const time = rawDate && Number.isFinite(Date.parse(rawDate)) ? Date.parse(rawDate) : null;
      const key = available ? ref.id : (() => {
        requireCondition(!!process.env.SESSION_SECRET, "INFO_CONTEXT_SIGNING_UNAVAILABLE");
        return createHmac("sha256", process.env.SESSION_SECRET!).update(JSON.stringify([actor, mainCardId, version.version, ref.source, ref.origin, ref.id])).digest("hex");
      })();
      const entry: InfoConsultationEntry = available ? { ...found, key, source: ref.source,
        ...(ref.origin ? { sourceCardTemplateId: ref.origin } : {}), attachedAt: time !== null ? new Date(time).toISOString() : null }
        : { status: "unavailable", key };
      return [{ entry, time, tie: available ? ref.id : key }];
    }).sort((a, b) => (b.time ?? -Infinity) - (a.time ?? -Infinity) || (a.tie < b.tie ? -1 : a.tie > b.tie ? 1 : 0));
    return { mainCardId, mainCardVersion: version.version, ...(sources ? { personalSources: sources } : {}), entries: entries.map(item => item.entry) };
  });
}

// The Info Card consultation (pouch) for one Card resumes the owner's pending requests for the Info Cards it
// shows: Personal notes made on this Card and the owner's own Creator Info Cards attached to it (checkpoint 10).
// A completed request changes what the pouch shows, so the snapshot is read again only then.
export async function resumingInfoConsultation(repo: InfoCardRepository, actor: string, mainCardId: string, context: MainInfoContext): Promise<InfoConsultationSnapshot> {
  const first = await mainInfoConsultation(repo, actor, mainCardId, context);
  const own = first.entries.flatMap(entry => entry.status === "available" && entry.info.ownerUserId === actor && entry.info.kind !== "personal" ? [entry.info.infoCardId] : []);
  const publications = await repo.resumePendingPublications(actor, { $or: [{ infoCardId: { $in: own } },
    ...(context.mode === "working" ? [{ kind: "personal" as const, originCardTemplateId: mainCardId }] : [])] });
  const snapshot = publications.some(state => state.status === "published") ? await mainInfoConsultation(repo, actor, mainCardId, context) : first;
  return publications.length ? { ...snapshot, publications } : snapshot;
}

export async function infoCatalogue(repo: InfoCardRepository, actor: string, query: InfoQuery = {}) {
  infoId(actor); const { search, offset, limit } = page(query);
  return repo.transaction(async session => {
    // ACL filters precede every group/count/search/pagination operation.
    const pipeline: Document[] = [{ $match: { $and: [CREATOR_INFO_FILTER], deletedAt: { $exists: false }, latestVersion: { $gt: 0 }, $or: [{ ownerUserId: actor }, { visibility: "public" }] } },
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
        { $match: { $and: [CREATOR_INFO_FILTER], deletedAt: { $exists: false }, visibility: "public", $expr: { $and: [{ $eq: ["$infoCardId", "$$id"] }, { $eq: ["$latestVersion", "$$version"] }] } } }, { $project: { _id: 1 } },
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

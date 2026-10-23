import { MongoServerError, type ClientSession, type Db, type MongoClient } from "mongodb";
import { CardRepository, COLLECTIONS as MAIN } from "../cards/repository";
import { CardArchitectureError, requireCondition } from "../cards/domain";
import { sameContent } from "../cards/publicationRules";
import { withMongoTransaction } from "../mongodb";
import { assertInfoDraft, infoId, infoReferences, revision, seriesName, visibility } from "./domain";
import { EMPTY_INFO_DRAFT, type InfoContent, type InfoDraft, type InfoPublication, type InfoRoot, type InfoSeries } from "./model";
import type { Visibility } from "../cards/model";
import { measureInfoCapacity } from "./capacity";
import { assertMediaAttachment, productionMediaSecurity, type InfoMediaSecurity } from "./media";
import { INFO_MEDIA_COLLECTION } from "./mediaRegistry";

export const INFO_COLLECTIONS = { roots: "infoCards", versions: "infoCardVersions", series: "infoCardSeries" } as const;
const readyIndexes = new WeakMap<MongoClient, Map<string, Promise<void>>>();
export async function createInfoCardIndexes(db: Db) {
  await db.collection(INFO_COLLECTIONS.roots).createIndex({ infoCardId: 1 }, { unique: true });
  await db.collection(INFO_COLLECTIONS.roots).createIndex({ ownerUserId: 1, updatedAt: -1, infoCardId: 1 });
  await db.collection(INFO_COLLECTIONS.roots).createIndex({ visibility: 1, latestVersion: 1, infoCardId: 1 });
  await db.collection(INFO_COLLECTIONS.versions).createIndex({ infoCardId: 1, version: 1 }, { unique: true });
  await db.collection(INFO_COLLECTIONS.versions).createIndex({ infoCardId: 1, sourceRevision: 1 }, { unique: true });
  await db.collection(INFO_COLLECTIONS.versions).createIndex({ "content.seriesId": 1, visibility: 1, infoCardId: 1 });
  await db.collection(INFO_COLLECTIONS.series).createIndex({ seriesId: 1 }, { unique: true });
  await db.collection(INFO_COLLECTIONS.series).createIndex({ createdByUserId: 1, normalisedTitle: 1 }, { unique: true });
  await db.collection(MAIN.cards).createIndex({ "draft.infoCardIds": 1 });
  await db.collection(MAIN.cardVersions).createIndex({ "content.infoCardIds": 1 });
  await db.collection(INFO_MEDIA_COLLECTION).createIndex({ provider: 1, assetId: 1 }, { unique: true });
  await db.collection(INFO_MEDIA_COLLECTION).createIndex({ provider: 1, src: 1 });
}
export class InfoCapacityError extends CardArchitectureError {
  constructor(readonly capacity: ReturnType<typeof measureInfoCapacity>) { super("INFO_CAPACITY_EXCEEDED"); }
}
export class InfoReferenceError extends CardArchitectureError {
  constructor(readonly blockers: { draft: boolean; historical: boolean }) { super("INFO_REFERENCED_CONFLICT"); }
}

export class InfoCardRepository {
  constructor(readonly db: Db, readonly client: MongoClient, readonly mediaSecurity: InfoMediaSecurity = productionMediaSecurity) {}
  static async application() {
    const main = await CardRepository.application(); const repo = new InfoCardRepository(main.db, main.client);
    await repo.assertIndexesReady(); return repo;
  }
  async assertIndexesReady() {
    // Index creation is an explicit deployment step. Do not accept writes in an
    // uninitialised database where unique identity/concurrency promises are false.
    let databases = readyIndexes.get(this.client);
    if (!databases) { databases = new Map(); readyIndexes.set(this.client, databases); }
    let ready = databases.get(this.db.databaseName);
    if (!ready) {
      ready = (async () => {
        for (const [collection, keys] of [
          [INFO_COLLECTIONS.roots, [{ infoCardId: 1 }]],
          [INFO_COLLECTIONS.versions, [{ infoCardId: 1, version: 1 }, { infoCardId: 1, sourceRevision: 1 }]],
          [INFO_COLLECTIONS.series, [{ seriesId: 1 }, { createdByUserId: 1, normalisedTitle: 1 }]],
          [INFO_MEDIA_COLLECTION, [{ provider: 1, assetId: 1 }]],
        ] as const) {
          const indexes = await this.db.collection(collection).listIndexes().toArray();
          requireCondition(keys.every(key => indexes.some(index => index.unique && !index.sparse && !index.partialFilterExpression
            && sameContent(index.key, key))), "INFO_INDEX_SETUP_REQUIRED");
        }
      })().catch(() => { databases!.delete(this.db.databaseName); throw new CardArchitectureError("INFO_INDEX_SETUP_REQUIRED"); });
      databases.set(this.db.databaseName, ready);
    }
    return ready;
  }
  roots() { return this.db.collection<InfoRoot>(INFO_COLLECTIONS.roots); }
  versions() { return this.db.collection<InfoPublication>(INFO_COLLECTIONS.versions); }
  series() { return this.db.collection<InfoSeries>(INFO_COLLECTIONS.series); }
  transaction<T>(run: (session: ClientSession) => Promise<T>) { return withMongoTransaction(this.client, run); }

  async owner(actor: string, id: string, session?: ClientSession) {
    infoId(actor); infoId(id);
    const root = await this.roots().findOne({ infoCardId: id, ownerUserId: actor, deletedAt: { $exists: false } }, { session, projection: { _id: 0 } });
    // Same response for absent and foreign IDs.
    requireCondition(root, "INFO_FORBIDDEN"); return root;
  }

  async create(actor: string, id: string) {
    infoId(actor); infoId(id);
    const now = new Date();
    const root: InfoRoot = { infoCardId: id, ownerUserId: actor, visibility: "private", draftVisibility: "private",
      draft: { ...EMPTY_INFO_DRAFT }, latestVersion: 0, revision: 0, referenceRevision: 0, createdAt: now, updatedAt: now };
    try { await this.roots().insertOne({ ...root }); return root; }
    catch (error) {
      if (!(error instanceof MongoServerError) || error.code !== 11000) throw error;
      const prior = await this.roots().findOne({ infoCardId: id, ownerUserId: actor }, { projection: { _id: 0 } });
      requireCondition(prior && !prior.deletedAt && prior.revision === 0 && prior.latestVersion === 0 && sameContent(prior.draft, EMPTY_INFO_DRAFT), "INFO_CREATE_RECOVERY_CONFLICT");
      return prior;
    }
  }

  async createSeries(actor: string, id: string, titleInput: unknown) {
    infoId(actor); infoId(id); const name = seriesName(titleInput);
    const record: InfoSeries = { seriesId: id, ...name, createdByUserId: actor, createdAt: new Date() };
    try { await this.series().insertOne({ ...record }); return record; }
    catch (error) {
      if (!(error instanceof MongoServerError) || error.code !== 11000) throw error;
      const prior = await this.series().findOne({ createdByUserId: actor, normalisedTitle: name.normalisedTitle }, { projection: { _id: 0 } });
      requireCondition(prior, "SERIES_ID_CONFLICT"); return prior;
    }
  }

  async eligibleSeries(actor: string, id: string, retained: string | null, session: ClientSession) {
    infoId(id);
    const series = await this.series().findOne({ seriesId: id }, { session, projection: { _id: 0 } });
    requireCondition(series, "SERIES_FORBIDDEN");
    if (series.createdByUserId === actor || retained === id) return series;
    const publicMember = await this.versions().aggregate([
      { $match: { "content.seriesId": id, visibility: "public" } },
      { $lookup: { from: INFO_COLLECTIONS.roots, let: { id: "$infoCardId", version: "$version" }, pipeline: [
        { $match: { visibility: "public", $expr: { $and: [{ $eq: ["$infoCardId", "$$id"] }, { $eq: ["$latestVersion", "$$version"] }] } } },
        { $project: { _id: 1 } },
      ], as: "root" } }, { $match: { "root.0": { $exists: true } } }, { $limit: 1 },
    ], { session }).hasNext();
    requireCondition(publicMember, "SERIES_FORBIDDEN"); return series;
  }

  async save(actor: string, id: string, expected: number, content: InfoDraft, intent: Visibility, mediaProof?: string) {
    revision(expected); assertInfoDraft(content); visibility(intent);
    return this.transaction(async session => {
      const root = await this.owner(actor, id, session);
      const published = root.latestVersion ? await this.versions().findOne({ infoCardId: id, version: root.latestVersion }, { session }) : null;
      const effective = root.draft ?? published?.content;
      if (root.revision === expected + 1 && root.draftVisibility === intent && sameContent(effective, content)) return root;
      requireCondition(root.revision === expected, "STALE_INFO_REVISION");
      requireCondition(root.visibility !== "public" || intent === "public", "PUBLIC_VISIBILITY_PERMANENT");
      if (content.seriesId) await this.eligibleSeries(actor, content.seriesId, effective?.seriesId ?? null, session);
      await assertMediaAttachment(this, actor, root, content.mediaItem, mediaProof, session);
      const draft = published && intent === root.visibility && sameContent(content, published.content) ? null : content;
      await this.roots().updateOne({ infoCardId: id, revision: expected }, { $set: { draft, draftVisibility: intent, updatedAt: new Date() }, $inc: { revision: 1 } }, { session });
      return (await this.owner(actor, id, session));
    });
  }

  async publish(actor: string, id: string, expected: number) {
    revision(expected);
    // External provider checks happen once, outside retriable Mongo callbacks.
    const before = await this.owner(actor, id);
    const prior = await this.versions().findOne({ infoCardId: id, sourceRevision: expected }, { projection: { _id: 0 } });
    if (prior) return prior;
    requireCondition(before.revision === expected, "STALE_INFO_REVISION");
    if (before.draft?.mediaItem) await this.mediaSecurity.assertReady(actor, before, before.draft.mediaItem);
    return this.transaction(async session => {
      const root = await this.owner(actor, id, session);
      const receipt = await this.versions().findOne({ infoCardId: id, sourceRevision: expected }, { session, projection: { _id: 0 } });
      if (receipt) return receipt;
      requireCondition(root.revision === expected, "STALE_INFO_REVISION");
      const content = root.draft;
      requireCondition(content && content.seriesId, "INFO_PUBLICATION_INCOMPLETE");
      const series = await this.eligibleSeries(actor, content.seriesId, content.seriesId, session);
      const capacity = measureInfoCapacity({ ...content, seriesTitle: series.title, hasMedia: !!content.mediaItem });
      if (!capacity.fits) throw new InfoCapacityError(capacity);
      requireCondition(root.visibility !== "public" || root.draftVisibility === "public", "PUBLIC_VISIBILITY_PERMANENT");
      const publication: InfoPublication = { infoCardId: id, version: root.latestVersion + 1, content: content as InfoContent,
        visibility: root.draftVisibility, sourceRevision: expected, publishedAt: new Date(), publishedByUserId: actor };
      await this.versions().insertOne({ ...publication }, { session });
      await this.roots().updateOne({ infoCardId: id, revision: expected }, { $set: { latestVersion: publication.version,
        visibility: publication.visibility, draft: null, updatedAt: publication.publishedAt }, $inc: { revision: 1 } }, { session });
      return publication;
    });
  }

  async drafts(actor: string, offset = 0, limit = 30) {
    infoId(actor);
    requireCondition(Number.isSafeInteger(offset) && offset >= 0 && Number.isSafeInteger(limit) && limit > 0 && limit <= 50, "INVALID_INFO_PAGE");
    const items = await this.roots().find({ ownerUserId: actor, draft: { $ne: null } }, { projection: { _id: 0 } })
      .sort({ updatedAt: -1, infoCardId: 1 }).skip(offset).limit(limit + 1).toArray();
    return { items: items.slice(0, limit), nextOffset: items.length > limit ? offset + limit : null };
  }

  // Internal Phase 4 primitive. Caller MUST derive ids from the authorised main
  // content and perform its canonical write inside this SAME transaction/session.
  // Draft saves use "private" (selection eligibility); use the effective main
  // visibility for publication so own-private references can be staged in drafts.
  async withReferences<T>(actor: string, ids: unknown, mainVisibility: Visibility,
    write: (session: ClientSession, ids: string[]) => Promise<T>) {
    infoId(actor); visibility(mainVisibility); const ordered = infoReferences(ids);
    return this.transaction(async session => {
      await this.guardReferences(actor, ordered, mainVisibility, session);
      return write(session, ordered);
    });
  }
  async guardReferences(actor: string, ids: unknown, mainVisibility: Visibility, session: ClientSession) {
    infoId(actor); visibility(mainVisibility); requireCondition(session.inTransaction(), "INFO_TRANSACTION_REQUIRED");
    for (const id of infoReferences(ids).sort()) {
      const root = await this.roots().findOne({ infoCardId: id }, { session });
      requireCondition(root && !root.deletedAt && root.latestVersion > 0 && (root.visibility === "public" || root.ownerUserId === actor), "INFO_REFERENCE_FORBIDDEN");
      requireCondition(mainVisibility !== "public" || root.visibility === "public", "PRIVATE_INFO_BLOCKS_PUBLICATION");
      const version = await this.versions().findOne({ infoCardId: id, version: root.latestVersion }, { session });
      requireCondition(version && version.visibility === root.visibility, "INFO_REFERENCE_FORBIDDEN");
      await this.roots().updateOne({ infoCardId: id }, { $inc: { referenceRevision: 1 } }, { session });
    }
  }

  async delete(actor: string, id: string, expected: number) {
    infoId(actor); infoId(id); revision(expected);
    return this.transaction(async session => {
      const retired = await this.roots().findOne({ infoCardId: id, ownerUserId: actor, deletedAt: { $exists: true } }, { session });
      if (retired && retired.revision === expected + 1) return { deleted: true };
      const root = await this.owner(actor, id, session);
      requireCondition(root.revision === expected, "STALE_INFO_REVISION");
      await this.roots().updateOne({ infoCardId: id }, { $inc: { referenceRevision: 1 } }, { session });
      const draft = !!await this.db.collection(MAIN.cards).findOne({ "draft.infoCardIds": id }, { session, projection: { _id: 1 } });
      const historical = !!await this.db.collection(MAIN.cardVersions).findOne({ "content.infoCardIds": id }, { session, projection: { _id: 1 } });
      if (draft || historical) throw new InfoReferenceError({ draft, historical });
      await this.versions().deleteMany({ infoCardId: id }, { session });
      await this.roots().updateOne({ infoCardId: id }, { $set: { deletedAt: new Date(), updatedAt: new Date(), draft: null, latestVersion: 0 }, $inc: { revision: 1 } }, { session });
      // Content/publications removed; reserve the stable ID so delayed requests
      // cannot address a different entity with the same ID/version. No asset GC.
      return { deleted: true };
    });
  }
}

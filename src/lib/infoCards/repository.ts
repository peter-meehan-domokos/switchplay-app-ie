import { MongoServerError, type ClientSession, type Db, type Filter, type MongoClient } from "mongodb";
import { CardRepository, COLLECTIONS as MAIN } from "../cards/repository";
import { CardArchitectureError, requireCondition } from "../cards/domain";
import { sameContent } from "../cards/publicationRules";
import { withMongoTransaction } from "../mongodb";
import { assertInfoDraft, infoId, infoReferences, revision, seriesName, visibility } from "./domain";
import { CREATOR_INFO_FILTER, EMPTY_INFO_DRAFT, isCreatorInfo, isGroupInfo, isNoteInfo, isPersonalInfo, type PendingPublication, type PendingPublicationReceipt, type PersonalInfoContext, type PublicationRequestState, type InfoContent, type InfoDraft, type InfoPublication, type InfoRoot, type InfoSeries } from "./model";
import type { Visibility } from "../cards/model";
import { measureInfoCapacity } from "./capacity";
import { assertMediaAttachment, productionMediaSecurity, type InfoMediaReadiness, type InfoMediaSecurity } from "./media";
import { InfoMathsError, type InfoRenderingChecker } from "./mathsValidation";
import { validateInfoCardContent } from "../../components/info-cards/infoCardContentValidation";
import { INFO_MEDIA_COLLECTION } from "./mediaRegistry";
import { creatorUsernames, UNKNOWN_CREATOR } from "../cards/creatorAttribution";
import { GroupExperienceRepository } from "../groupExperiences/repository";
import { GroupMediaRepository } from "../groupExperiences/media/repository";
import { selectedCard } from "../groupExperiences/publicVersions";
import { creationContextOf, FOLLOWER_CONTRIBUTIONS, identityRole, isCreationContext } from "../groupExperiences/media/contributionIdentity";

export const INFO_COLLECTIONS = { roots: "infoCards", versions: "infoCardVersions", series: "infoCardSeries" } as const;
const readyIndexes = new WeakMap<MongoClient, Map<string, Promise<void>>>();
export async function createInfoCardIndexes(db: Db) {
  await db.collection(INFO_COLLECTIONS.roots).createIndex({ infoCardId: 1 }, { unique: true });
  await db.collection(INFO_COLLECTIONS.roots).createIndex({ ownerUserId: 1, updatedAt: -1, infoCardId: 1 });
  await db.collection(INFO_COLLECTIONS.roots).createIndex({ visibility: 1, latestVersion: 1, infoCardId: 1 });
  // Group Info Cards (checkpoints 4.2-4.4), as group_media_owner_history and group_media_shared_history do for media.
  // Performance only: no query or readiness check depends on them being installed.
  await db.collection(INFO_COLLECTIONS.roots).createIndex({ ownerUserId: 1, originCardTemplateId: 1, createdAt: -1, infoCardId: 1 }, { name: "group_info_owner_history" });
  await db.collection(INFO_COLLECTIONS.roots).createIndex({ experienceId: 1, originCardTemplateId: 1, groupVisible: 1, createdAt: -1, infoCardId: 1 }, { name: "group_info_shared_history" });
  await db.collection(INFO_COLLECTIONS.versions).createIndex({ infoCardId: 1, version: 1 }, { unique: true });
  await db.collection(INFO_COLLECTIONS.versions).createIndex({ infoCardId: 1, sourceRevision: 1 }, { unique: true });
  await db.collection(INFO_COLLECTIONS.versions).createIndex({ "content.seriesId": 1, visibility: 1, infoCardId: 1 });
  await db.collection(INFO_COLLECTIONS.series).createIndex({ seriesId: 1 }, { unique: true });
  await db.collection(INFO_COLLECTIONS.series).createIndex({ createdByUserId: 1, normalisedTitle: 1 }, { unique: true });
  await db.collection(MAIN.cards).createIndex({ "draft.infoCardIds": 1 });
  await db.collection(MAIN.cardVersions).createIndex({ "content.infoCardIds": 1 });
  await db.collection(MAIN.users).createIndex({ "cardsData.personalInfoCardIds": 1 });
  await db.collection(INFO_MEDIA_COLLECTION).createIndex({ provider: 1, assetId: 1 }, { unique: true });
  await db.collection(INFO_MEDIA_COLLECTION).createIndex({ provider: 1, src: 1 });
}
type PersonalPublication = { context?: PersonalInfoContext; resume?: boolean };
// At most this many of the owner's requests are checked per list visit; each check is one provider request.
const RESUME_LIMIT = 10;
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
  async assertIndexesReady(includeMainReferences = false, includePersonalReferences = false) {
    // Index creation is an explicit deployment step. Do not accept writes in an
    // uninitialised database where unique identity/concurrency promises are false.
    let databases = readyIndexes.get(this.client);
    if (!databases) { databases = new Map(); readyIndexes.set(this.client, databases); }
    const readinessKey = JSON.stringify([this.db.databaseName, includeMainReferences, includePersonalReferences]);
    let ready = databases.get(readinessKey);
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
        if (includeMainReferences) for (const [collection, key] of [
          [MAIN.cards, { "draft.infoCardIds": 1 }], [MAIN.cardVersions, { "content.infoCardIds": 1 }],
        ] as const) {
          const indexes = await this.db.collection(collection).listIndexes().toArray();
          requireCondition(indexes.some(index => !index.sparse && !index.partialFilterExpression && sameContent(index.key, key)), "INFO_INDEX_SETUP_REQUIRED");
        }
        if (includePersonalReferences) {
          const indexes = await this.db.collection(MAIN.users).listIndexes().toArray();
          requireCondition(indexes.some(index => !index.sparse && !index.partialFilterExpression
            && sameContent(index.key, { "cardsData.personalInfoCardIds": 1 })), "INFO_INDEX_SETUP_REQUIRED");
        }
      })().catch(() => { databases!.delete(readinessKey); throw new CardArchitectureError("INFO_INDEX_SETUP_REQUIRED"); });
      databases.set(readinessKey, ready);
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
    // Same response for absent and foreign IDs. The author reads their own Group contributions of either
    // identity here; every write is then authorised from the stored creation context by manageable (C1).
    requireCondition(root && (isCreatorInfo(root) || isPersonalInfo(root) || isGroupInfo(root)), "INFO_FORBIDDEN"); return root;
  }
  // The guard every Info Card write uses (checkpoint 4.2b, C1 and C4): the author, and for a Group contribution
  // the author's current role in its originating Group for its stored identity, an active follower for "self"
  // and a current admin for "group". Everything comes from the stored root, never from the client. The current
  // membership record is fenced in the same transaction, so a concurrent removal, demotion or rejoin conflicts.
  // Creator and standalone Personal Info Cards keep their existing owner-only rule.
  async manageable(actor: string, id: string, session: ClientSession) {
    const root = await this.owner(actor, id, session);
    if (isGroupInfo(root)) {
      const groups = new GroupExperienceRepository(new CardRepository(this.db, this.client));
      const { member } = await groups.access(actor, root.experienceId!, identityRole(creationContextOf(root)), session);
      await groups.fence([member], session);
    }
    return root;
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
      requireCondition(prior && isCreatorInfo(prior) && !prior.deletedAt && prior.revision === 0 && prior.latestVersion === 0 && sameContent(prior.draft, EMPTY_INFO_DRAFT), "INFO_CREATE_RECOVERY_CONFLICT");
      return prior;
    }
  }

  async createPersonal(actor: string, id: string, origin: string, context: PersonalInfoContext) {
    infoId(actor); infoId(id); infoId(origin);
    await this.assertIndexesReady(true, true);
    return this.transaction(async session => {
      const main = new CardRepository(this.db, this.client);
      await main.consultationCardVersion(actor, origin, { mode: "working", ...context }, session);
      const user = await main.getPersonalUser(actor, session);
      requireCondition(user?.cardsData.filter(data => data.cardTemplateId === origin).length === 1, "AMBIGUOUS_CARD_DATA");
      const existing = await this.roots().findOne({ infoCardId: id }, { session, projection: { _id: 0 } });
      if (existing) {
        requireCondition(existing.ownerUserId === actor && isPersonalInfo(existing) && existing.originCardTemplateId === origin
          && !existing.deletedAt && existing.revision === 0 && existing.latestVersion === 0 && sameContent(existing.draft, EMPTY_INFO_DRAFT), "INFO_CREATE_RECOVERY_CONFLICT");
        return existing;
      }
      const now = new Date();
      const root: InfoRoot = { infoCardId: id, ownerUserId: actor, kind: "personal", originCardTemplateId: origin,
        visibility: "private", draftVisibility: "private", draft: { ...EMPTY_INFO_DRAFT }, latestVersion: 0,
        revision: 0, referenceRevision: 0, createdAt: now, updatedAt: now };
      await this.roots().insertOne({ ...root }, { session }); return root;
    }).catch(async (error: unknown) => {
      if (!(error instanceof MongoServerError) || error.code !== 11000) throw error;
      const prior = await this.owner(actor, id);
      requireCondition(isPersonalInfo(prior) && prior.originCardTemplateId === origin && prior.latestVersion === 0
        && prior.revision === 0 && sameContent(prior.draft, EMPTY_INFO_DRAFT), "INFO_CREATE_RECOVERY_CONFLICT");
      return prior;
    });
  }

  // A Group contribution Info Card (checkpoint 4.2), created from Me as a Follower contribution and authorised
  // exactly like a Group media upload from Me: an active follower at the current access epoch, with the Card in
  // the Group manifest at that version. It is never attached to CardData. Admin creation is checkpoint 4.3.
  async createGroup(actor: string, id: string, experienceId: string, cardTemplateId: string, input: { accessEpoch: unknown; version: unknown; creationContext: unknown }) {
    infoId(actor); infoId(id); infoId(experienceId); infoId(cardTemplateId);
    requireCondition(isCreationContext(input.creationContext), "INVALID_GROUP_MEDIA_PERSPECTIVE");
    const creationContext = input.creationContext;
    requireCondition(Number.isSafeInteger(input.accessEpoch) && Number(input.accessEpoch) >= 0 && Number.isSafeInteger(input.version) && Number(input.version) > 0, "INVALID_INFO_CONTEXT");
    const media = new GroupMediaRepository(new GroupExperienceRepository(new CardRepository(this.db, this.client)));
    return this.transaction(async session => {
      // Exactly as a Group media upload: a Follower contribution from Me needs an active follower, an Admin
      // contribution from the Group perspective a current admin (checkpoint 4.3), the Card in the manifest.
      await media.creationAuthority(actor, experienceId, cardTemplateId, Number(input.accessEpoch), Number(input.version), session, creationContext);
      const existing = await this.roots().findOne({ infoCardId: id }, { session, projection: { _id: 0 } });
      if (existing) {
        requireCondition(existing.ownerUserId === actor && isGroupInfo(existing) && existing.experienceId === experienceId && existing.originCardTemplateId === cardTemplateId
          && existing.creationContext === creationContext && !existing.deletedAt && existing.revision === 0 && existing.latestVersion === 0 && sameContent(existing.draft, EMPTY_INFO_DRAFT), "INFO_CREATE_RECOVERY_CONFLICT");
        return existing;
      }
      const now = new Date();
      const root: InfoRoot = { infoCardId: id, ownerUserId: actor, kind: "group", originCardTemplateId: cardTemplateId, experienceId, creationContext, groupVisible: true,
        visibility: "private", draftVisibility: "private", draft: { ...EMPTY_INFO_DRAFT }, latestVersion: 0, revision: 0, referenceRevision: 0, createdAt: now, updatedAt: now };
      await this.roots().insertOne({ ...root }, { session }); return root;
    });
  }
  // Group hiding, exactly as for Group media: any current admin may hide any contribution originating in their
  // Group. It never deletes and never changes the author draft or revision; the author still sees it, private.
  async hideGroup(actor: string, experienceId: string, id: string, accessEpoch: unknown) {
    infoId(actor); infoId(experienceId); infoId(id);
    requireCondition(Number.isSafeInteger(accessEpoch) && Number(accessEpoch) >= 0, "INVALID_INFO_CONTEXT");
    const groups = new GroupExperienceRepository(new CardRepository(this.db, this.client));
    return this.transaction(async session => {
      const { member } = await groups.access(actor, experienceId, "admin", session, Number(accessEpoch));
      const root = await this.roots().findOne({ infoCardId: id, kind: "group", experienceId, deletedAt: { $exists: false }, latestVersion: { $gt: 0 } }, { session, projection: { _id: 0 } });
      requireCondition(root && isGroupInfo(root), "INFO_FORBIDDEN");
      await groups.fence([member], session);
      if (root.groupVisible !== false) await this.roots().updateOne({ infoCardId: id, kind: "group", experienceId }, { $set: { groupVisible: false } }, { session });
      return { infoCardId: id, experienceId, groupVisible: false };
    });
  }

  async removePersonal(actor: string, origin: string, id: string, expected: number) {
    infoId(actor); infoId(origin); infoId(id); revision(expected);
    await this.assertIndexesReady(true, true);
    return this.transaction(async session => {
      const main = new CardRepository(this.db, this.client), user = await main.getPersonalUser(actor, session);
      const records = user?.cardsData.filter(data => data.cardTemplateId === origin);
      requireCondition(records?.length === 1, "PERSONAL_INFO_FORBIDDEN");
      const data = records[0], ids = infoReferences(data.personalInfoCardIds), current = data.personalInfoRevision ?? 0;
      if (!ids.includes(id)) return { cardTemplateId: origin, personalInfoRevision: current,
        personalInfoCardIds: ids, personalInfoCardAttachedAt: data.personalInfoCardAttachedAt ?? {} };
      requireCondition(current === expected, "STALE_PERSONAL_INFO_REVISION");
      const dates = { ...data.personalInfoCardAttachedAt }; delete dates[id];
      const result = await main.users().updateOne({ _id: user!._id, cardsData: { $elemMatch: { cardTemplateId: origin,
        ...(expected === 0 ? { $or: [{ personalInfoRevision: 0 }, { personalInfoRevision: { $exists: false } }] } : { personalInfoRevision: expected }) } } }, {
        $set: { "cardsData.$.personalInfoCardIds": ids.filter(value => value !== id), "cardsData.$.personalInfoCardAttachedAt": dates },
        $inc: { "cardsData.$.personalInfoRevision": 1 },
      }, { session });
      requireCondition(result.matchedCount === 1, "STALE_PERSONAL_INFO_REVISION");
      return { cardTemplateId: origin, personalInfoRevision: current + 1,
        personalInfoCardIds: ids.filter(value => value !== id), personalInfoCardAttachedAt: dates };
    });
  }

  // The caller's current Personal Info Card list for this note's origin Card, returned after a Save so the
  // client can update its working copy. Null when the origin Card data is absent or ambiguous.
  async personalAssociation(actor: string, id: string) {
    const root = await this.owner(actor, id);
    // Group contributions never belong to CardData, so they have no standalone list to report.
    if (!isPersonalInfo(root)) return null;
    const user = await new CardRepository(this.db, this.client).getPersonalUser(actor);
    const sources = user?.cardsData.filter(data => data.cardTemplateId === root.originCardTemplateId) ?? [];
    const source = sources.length === 1 ? sources[0] : null;
    return source ? { cardTemplateId: source.cardTemplateId, personalInfoRevision: source.personalInfoRevision ?? 0,
      personalInfoCardIds: source.personalInfoCardIds ?? [], personalInfoCardAttachedAt: source.personalInfoCardAttachedAt ?? {} } : null;
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
        { $match: { $and: [CREATOR_INFO_FILTER], visibility: "public", deletedAt: { $exists: false }, $expr: { $and: [{ $eq: ["$infoCardId", "$$id"] }, { $eq: ["$latestVersion", "$$version"] }] } } },
        { $project: { _id: 1 } },
      ], as: "root" } }, { $match: { "root.0": { $exists: true } } }, { $limit: 1 },
    ], { session }).hasNext();
    requireCondition(publicMember, "SERIES_FORBIDDEN"); return series;
  }

  async save(actor: string, id: string, expected: number, content: InfoDraft, intent: Visibility, mediaProof?: string) {
    revision(expected); assertInfoDraft(content); visibility(intent);
    return this.transaction(async session => {
      const root = await this.manageable(actor, id, session);
      requireCondition(!isNoteInfo(root) || intent === "private", "PERSONAL_INFO_PRIVATE_ONLY");
      const published = root.latestVersion ? await this.versions().findOne({ infoCardId: id, version: root.latestVersion }, { session }) : null;
      const effective = root.draft ?? published?.content;
      requireCondition(!effective?.bodyFormat || content.bodyFormat === effective.bodyFormat, "INFO_FORMAT_CONFLICT");
      if (root.revision === expected + 1 && root.draftVisibility === intent && sameContent(effective, content)) return root;
      requireCondition(root.revision === expected, "STALE_INFO_REVISION");
      requireCondition(isPersonalInfo(root) || root.visibility !== "public" || intent === "public", "PUBLIC_VISIBILITY_PERMANENT");
      if (content.seriesId) await this.eligibleSeries(actor, content.seriesId, effective?.seriesId ?? null, session);
      await assertMediaAttachment(this, actor, root, content.mediaItem, mediaProof, session);
      const draft = published && intent === root.visibility && sameContent(content, published.content) ? null : content;
      // Any newer draft save cancels a pending Publish or Save (scenario E): an outdated revision is never published.
      await this.roots().updateOne({ infoCardId: id, revision: expected }, { $set: { draft, draftVisibility: intent,
        ...(isNoteInfo(root) ? { visibility: "private" as const } : {}), updatedAt: new Date() },
        $unset: { pendingPublication: "", lastPublicationFailure: "" }, $inc: { revision: 1 } }, { session });
      return (await this.owner(actor, id, session));
    });
  }

  async publish(actor: string, id: string, expected: number) {
    return this.publishVersion(actor, id, expected);
  }
  async savePersonal(actor: string, id: string, expected: number, context?: PersonalInfoContext) {
    await this.assertIndexesReady(true, true);
    return this.publishVersion(actor, id, expected, { context });
  }
  // Creator Publish and Personal Save share one path. Every check except media readiness runs first; a video
  // that is still processing records a pending request instead of publishing (checkpoint 10).
  private async publishVersion(actor: string, id: string, expected: number, personal?: PersonalPublication,
    known?: InfoMediaReadiness): Promise<InfoPublication | PendingPublicationReceipt> {
    revision(expected);
    // External provider checks happen once, outside retriable Mongo callbacks.
    const before = await this.owner(actor, id);
    requireCondition(personal ? isNoteInfo(before) : isCreatorInfo(before), "INFO_FORBIDDEN");
    const prior = await this.versions().findOne({ infoCardId: id, sourceRevision: expected }, { projection: { _id: 0 } });
    if (prior) return prior;
    requireCondition(before.revision === expected, "STALE_INFO_REVISION");
    if (personal && before.draft === null && before.latestVersion > 0) {
      const current = await this.versions().findOne({ infoCardId: id, version: before.latestVersion }, { projection: { _id: 0 } });
      requireCondition(current?.visibility === "private", "INFO_FORBIDDEN"); return current;
    }
    if (before.draft?.bodyFormat) {
      const draft = before.draft;
      assertInfoDraft(draft);
      requireCondition(draft.seriesId && draft.title.trim() && draft.body.trim(), "INFO_PUBLICATION_INCOMPLETE");
      // Reuse the renderer's pure source preparation for syntax/security only, on the same tag-free items the
      // face renders (Info Card formatting tags never reach KaTeX). No DOM layout, capacity or browser launch.
      const prepared = validateInfoCardContent(draft.body);
      if (prepared.invalid) throw new InfoMathsError({ result: { status: "invalid-input", generation: 0, diagnostics: prepared.diagnostics }, safe: false, headerFits: false });
    }
    const readiness = before.draft?.mediaItem ? known ?? await this.mediaSecurity.readiness(actor, before, before.draft.mediaItem) : "ready";
    // Never publish without the intended media.
    requireCondition(readiness !== "failed", "INFO_MEDIA_PROCESSING_FAILED");
    if (readiness === "processing") return this.requestPublication(actor, id, expected, personal);
    return this.transaction(async session => {
      const root = await this.manageable(actor, id, session);
      requireCondition(personal ? isNoteInfo(root) : isCreatorInfo(root), "INFO_FORBIDDEN");
      const receipt = await this.versions().findOne({ infoCardId: id, sourceRevision: expected }, { session, projection: { _id: 0 } });
      if (receipt) return receipt;
      requireCondition(root.revision === expected, "STALE_INFO_REVISION");
      const { content, attachment } = await this.publicationChecks(actor, root, personal, session);
      const publication: InfoPublication = { infoCardId: id, version: root.latestVersion + 1, content,
        visibility: personal ? "private" : root.draftVisibility, sourceRevision: expected, publishedAt: new Date(), publishedByUserId: actor };
      if (attachment) {
        const result = await new CardRepository(this.db, this.client).users().updateOne({ _id: attachment.userId, cardsData: { $elemMatch: { cardTemplateId: attachment.source,
          ...(attachment.personalInfoRevision === 0 ? { $or: [{ personalInfoRevision: 0 }, { personalInfoRevision: { $exists: false } }] } : { personalInfoRevision: attachment.personalInfoRevision }) } } }, {
          $push: { "cardsData.$.personalInfoCardIds": id },
          $set: { [`cardsData.$.personalInfoCardAttachedAt.${id}`]: publication.publishedAt },
          $inc: { "cardsData.$.personalInfoRevision": 1 },
        }, { session });
        requireCondition(result.matchedCount === 1, "STALE_PERSONAL_INFO_REVISION");
      }
      await this.versions().insertOne({ ...publication }, { session });
      // Publishing clears any pending request for this revision in the same conditional write, so a repeated or
      // concurrent completion finds the receipt above and never creates a second version.
      await this.roots().updateOne({ infoCardId: id, revision: expected }, { $set: { latestVersion: publication.version,
        visibility: publication.visibility, draftVisibility: publication.visibility, draft: null, updatedAt: publication.publishedAt },
        $unset: { pendingPublication: "", lastPublicationFailure: "" },
        $inc: { revision: 1, ...(attachment ? { referenceRevision: 1 } : {}) } }, { session });
      return publication;
    });
  }
  // The checks a publication of this exact revision must pass inside its transaction. Used both to publish and,
  // without writing, to accept a pending request, so a request is only recorded when completion can succeed.
  private async publicationChecks(actor: string, root: InfoRoot, personal: PersonalPublication | undefined, session: ClientSession) {
    const content = root.draft;
    requireCondition(content && content.seriesId, "INFO_PUBLICATION_INCOMPLETE");
    const series = await this.eligibleSeries(actor, content.seriesId, content.seriesId, session);
    if (content.bodyFormat) {
      requireCondition(content.title.trim() && content.body.trim(), "INFO_PUBLICATION_INCOMPLETE");
      requireCondition(!/[\r\n\t\p{Cc}\p{Cf}]/u.test(content.title + series.title), "INVALID_INFO_TEXT");
    } else {
      const capacity = measureInfoCapacity({ ...content, seriesTitle: series.title, hasMedia: !!content.mediaItem });
      if (!capacity.fits) throw new InfoCapacityError(capacity);
    }
    requireCondition(personal || root.visibility !== "public" || root.draftVisibility === "public", "PUBLIC_VISIBILITY_PERMANENT");
    if (isGroupInfo(root)) {
      // Every write already passed manageable: the author holds the role of the stored identity in the
      // originating Group. The first Save also makes the contribution visible in its Group, so it rechecks, as a
      // media commit does, that the Card is still selected in that Group.
      if (root.latestVersion === 0) {
        const main = new CardRepository(this.db, this.client), groups = new GroupExperienceRepository(main);
        const { experience } = await groups.access(actor, root.experienceId!, identityRole(creationContextOf(root)), session);
        await selectedCard(main, experience, root.originCardTemplateId!, session);
      }
      return { content: content as InfoContent, attachment: null };
    }
    if (!personal || root.latestVersion !== 0) return { content: content as InfoContent, attachment: null };
    requireCondition(personal.context, "PERSONAL_INFO_CONTEXT_REQUIRED");
    const main = new CardRepository(this.db, this.client), context = personal.context;
    await main.consultationCardVersion(actor, root.originCardTemplateId!, { mode: "working", deckTemplateId: context.deckTemplateId, version: context.version }, session);
    const user = await main.getPersonalUser(actor, session);
    const records = user?.cardsData.filter(data => data.cardTemplateId === root.originCardTemplateId);
    requireCondition(records?.length === 1, "AMBIGUOUS_CARD_DATA");
    const data = records[0], current = data.personalInfoRevision ?? 0;
    // A resumed request uses the list revision as it is now; a direct Save keeps its compare-and-set.
    if (!personal.resume) { revision(context.personalInfoRevision); requireCondition(current === context.personalInfoRevision, "STALE_PERSONAL_INFO_REVISION"); }
    requireCondition(!infoReferences(data.personalInfoCardIds).includes(root.infoCardId), "PERSONAL_INFO_ALREADY_ATTACHED");
    return { content: content as InfoContent, attachment: { userId: user!._id, source: root.originCardTemplateId!, personalInfoRevision: current } };
  }
  private async requestPublication(actor: string, id: string, expected: number, personal?: PersonalPublication): Promise<PendingPublicationReceipt> {
    return this.transaction(async session => {
      const root = await this.manageable(actor, id, session);
      requireCondition(personal ? isNoteInfo(root) : isCreatorInfo(root), "INFO_FORBIDDEN");
      requireCondition(root.revision === expected, "STALE_INFO_REVISION");
      await this.publicationChecks(actor, root, personal, session);
      const context = personal?.context && root.latestVersion === 0 ? { deckTemplateId: personal.context.deckTemplateId, version: personal.context.version } : undefined;
      // Pressing again for the same revision keeps the original request.
      const pending: PendingPublication = root.pendingPublication?.revision === expected ? root.pendingPublication
        : { revision: expected, requestedAt: new Date(), ...(context ? { context } : {}) };
      await this.roots().updateOne({ infoCardId: id, revision: expected }, { $set: { pendingPublication: pending }, $unset: { lastPublicationFailure: "" } }, { session });
      return { status: "pending" as const, infoCardId: id, revision: expected };
    });
  }
  // The single completion helper for pending requests (checkpoint 10). It runs only when the owner is looking at
  // a relevant interface: the editor status poll, My Drafts, the Info Card list and the Info Card consultation.
  // Ready publishes through publishVersion; failed clears the request and records the failure; processing waits.
  async completePendingPublication(actor: string, id: string): Promise<PublicationRequestState | null> {
    const root = await this.owner(actor, id);
    const label = { infoCardId: id, title: root.draft?.title ?? "", kind: isNoteInfo(root) ? "personal" as const : "creator" as const };
    const pending = root.pendingPublication;
    if (!pending) return root.lastPublicationFailure?.revision === root.revision ? { ...label, status: "failed", code: root.lastPublicationFailure.code } : null;
    // A newer draft save always clears the request; a mismatch here is only a write still in flight.
    if (pending.revision !== root.revision) return null;
    // A Group contribution completes only while its author can still act in its creation context (C4). Checked
    // before media readiness, so a request made before leaving the Group fails now rather than waiting.
    if (isGroupInfo(root)) {
      try { await this.transaction(session => this.manageable(actor, id, session)); }
      catch (error) { if (error instanceof CardArchitectureError) return this.failPending(label, pending.revision, error.code); throw error; }
    }
    const media = root.draft?.mediaItem;
    let readiness: InfoMediaReadiness;
    try { readiness = media ? await this.mediaSecurity.readiness(actor, root, media) : "ready"; }
    catch (error) { if (error instanceof CardArchitectureError) return this.failPending(label, pending.revision, error.code); throw error; }
    if (readiness === "processing") return { ...label, status: "pending" };
    if (readiness === "failed") return this.failPending(label, pending.revision, "INFO_MEDIA_PROCESSING_FAILED");
    try {
      const result = await this.publishVersion(actor, id, pending.revision, isNoteInfo(root)
        ? { resume: true, ...(pending.context ? { context: { ...pending.context, personalInfoRevision: 0 } } : {}) } : undefined, "ready");
      return "version" in result ? { ...label, status: "published", version: result.version } : { ...label, status: "pending" };
    } catch (error) {
      if (!(error instanceof CardArchitectureError)) throw error;
      // An edit raced this check: the request is already cancelled.
      if (error.code === "STALE_INFO_REVISION") return null;
      return this.failPending(label, pending.revision, error.code);
    }
  }
  private async failPending(label: Omit<PublicationRequestState, "status">, expected: number, code: string): Promise<PublicationRequestState> {
    await this.roots().updateOne({ infoCardId: label.infoCardId, revision: expected, "pendingPublication.revision": expected },
      { $unset: { pendingPublication: "" }, $set: { lastPublicationFailure: { revision: expected, at: new Date(), code } } });
    return { ...label, status: "failed", code };
  }
  // Bounded resume of the owner's own pending requests when they open a list that shows them. Best effort: a
  // provider or database hiccup leaves the request pending for the next visit and never fails the list.
  // `scope` narrows the owner's own roots to the ones the visited interface shows.
  async resumePendingPublications(actor: string, scope: Filter<InfoRoot> = {}) {
    infoId(actor);
    const roots = await this.roots().find({ ownerUserId: actor, deletedAt: { $exists: false }, $and: [scope,
      { $or: [{ pendingPublication: { $exists: true } }, { lastPublicationFailure: { $exists: true } }] }] },
      { projection: { _id: 0 } }).sort({ updatedAt: -1, infoCardId: 1 }).limit(RESUME_LIMIT).toArray();
    const states = await Promise.all(roots.map(root => {
      const label = { infoCardId: root.infoCardId, title: root.draft?.title ?? "", kind: isNoteInfo(root) ? "personal" as const : "creator" as const };
      return root.pendingPublication
        ? this.completePendingPublication(actor, root.infoCardId).catch((): PublicationRequestState => ({ ...label, status: "pending" }))
        : Promise.resolve(root.lastPublicationFailure?.revision === root.revision ? { ...label, status: "failed" as const, code: root.lastPublicationFailure.code } : null);
    }));
    return states.filter((state): state is PublicationRequestState => state !== null);
  }

  async checkRendering(actor: string, id: string, expected: number, check: InfoRenderingChecker) {
    revision(expected);
    const root = await this.owner(actor, id);
    requireCondition(root.revision === expected, "STALE_INFO_REVISION");
    const content = root.draft ?? (await this.versions().findOne({ infoCardId: id, version: root.latestVersion }))?.content;
    requireCondition(content, "INFO_PUBLICATION_INCOMPLETE");
    assertInfoDraft(content);
    requireCondition(content.bodyFormat === "latex-v1", "INFO_MATHS_FORMAT_REQUIRED");
    const series = content.seriesId ? await this.series().findOne({ seriesId: content.seriesId }) : null;
    const names = await creatorUsernames(new CardRepository(this.db, this.client), [actor]);
    const result = await check(content, series?.title ?? "Series", { creatorUsername: names.get(actor) ?? UNKNOWN_CREATOR, personal: isNoteInfo(root) });
    // Diagnostics never write content, status, certificates or publications.
    const latest = await this.owner(actor, id);
    requireCondition(latest.revision === expected, "STALE_INFO_REVISION");
    if (series) requireCondition((await this.series().findOne({ seriesId: series.seriesId }))?.title === series.title, "STALE_INFO_REVISION");
    return { revision: expected, ...result };
  }

  async drafts(actor: string, offset = 0, limit = 30) {
    infoId(actor);
    requireCondition(Number.isSafeInteger(offset) && offset >= 0 && Number.isSafeInteger(limit) && limit > 0 && limit <= 50, "INVALID_INFO_PAGE");
    const main = new CardRepository(this.db, this.client), groups = new GroupExperienceRepository(main);
    const user = await main.getPersonalUser(actor);
    const personal = (user?.cardsData ?? []).flatMap(data => (data.personalInfoCardIds ?? []).map(id => ({ kind: "personal" as const, originCardTemplateId: data.cardTemplateId, infoCardId: id })));
    // Group contributions are listed only while never saved (C3): a saved one is edited from its creation context,
    // never through My Drafts. Only Groups where the author can still act as the stored identity count (C4).
    const memberships = await groups.members().find({ userId: actor }, { projection: { _id: 0, experienceId: 1, isAdmin: 1, followerStatus: 1 } }).toArray();
    const following = memberships.filter(member => member.followerStatus === "active").map(member => member.experienceId);
    const administering = memberships.filter(member => member.isAdmin).map(member => member.experienceId);
    const items = await this.roots().find({ ownerUserId: actor, deletedAt: { $exists: false }, draft: { $ne: null },
      $or: [CREATOR_INFO_FILTER, { kind: "personal", latestVersion: 0, originCardTemplateId: { $type: "string" } },
        { kind: "group", latestVersion: 0, experienceId: { $in: following }, ...FOLLOWER_CONTRIBUTIONS },
        { kind: "group", latestVersion: 0, experienceId: { $in: administering }, creationContext: "group" }, ...personal] }, { projection: { _id: 0 } })
      .sort({ updatedAt: -1, infoCardId: 1 }).skip(offset).limit(limit + 1).toArray();
    const page = items.slice(0, limit);
    // The originating Group name for each Group draft, so the entry stays identified with its context.
    const experienceIds = [...new Set(page.flatMap(root => isGroupInfo(root) ? [root.experienceId!] : []))];
    const named = experienceIds.length ? await groups.experiences().find({ experienceId: { $in: experienceIds } }, { projection: { _id: 0, experienceId: 1, name: 1 } }).toArray() : [];
    return { items: page, nextOffset: items.length > limit ? offset + limit : null,
      ...(named.length ? { groupNames: Object.fromEntries(named.map(group => [group.experienceId, group.name])) } : {}) };
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
      requireCondition(root && isCreatorInfo(root) && !root.deletedAt && root.latestVersion > 0 && (root.visibility === "public" || root.ownerUserId === actor), "INFO_REFERENCE_FORBIDDEN");
      requireCondition(mainVisibility !== "public" || root.visibility === "public", "PRIVATE_INFO_BLOCKS_PUBLICATION");
      const version = await this.versions().findOne({ infoCardId: id, version: root.latestVersion }, { session });
      requireCondition(version && version.visibility === root.visibility, "INFO_REFERENCE_FORBIDDEN");
      await this.roots().updateOne({ infoCardId: id }, { $inc: { referenceRevision: 1 } }, { session });
    }
  }

  async delete(actor: string, id: string, expected: number) {
    infoId(actor); infoId(id); revision(expected);
    await this.assertIndexesReady(true, true);
    return this.transaction(async session => {
      const retired = await this.roots().findOne({ infoCardId: id, ownerUserId: actor, deletedAt: { $exists: true } }, { session });
      if (retired && retired.revision === expected + 1) return { deleted: true };
      const root = await this.manageable(actor, id, session);
      requireCondition(root.revision === expected, "STALE_INFO_REVISION");
      await this.roots().updateOne({ infoCardId: id }, { $inc: { referenceRevision: 1 } }, { session });
      const draft = !!await this.db.collection(MAIN.cards).findOne({ "draft.infoCardIds": id }, { session, projection: { _id: 1 } });
      const historical = !!await this.db.collection(MAIN.cardVersions).findOne({ "content.infoCardIds": id }, { session, projection: { _id: 1 } });
      const personal = !!await this.db.collection(MAIN.users).findOne({ "cardsData.personalInfoCardIds": id }, { session, projection: { _id: 1 } });
      if (draft || historical || personal) throw new InfoReferenceError({ draft: draft || personal, historical });
      await this.versions().deleteMany({ infoCardId: id }, { session });
      await this.roots().updateOne({ infoCardId: id }, { $set: { deletedAt: new Date(), updatedAt: new Date(), draft: null, latestVersion: 0 }, $inc: { revision: 1 } }, { session });
      // Content/publications removed; reserve the stable ID so delayed requests
      // cannot address a different entity with the same ID/version. No asset GC.
      return { deleted: true };
    });
  }
}

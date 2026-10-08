import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { MongoServerError, ObjectId, type ClientSession, type Db, type MongoClient } from "mongodb";
import { getDatabase, getMongoClient, withMongoTransaction } from "../mongodb";
import { CardArchitectureError, assertAdoption, assertCardContent, assertDeckContent, initialCardData, nonblank, requireCondition, swapConstructionSteps } from "./domain";
import type { AdoptedVersion, CardContent, CardTemplateRoot, CardTemplateVersion, CreateAndAttachCardCommand, DeckContent, DeckData, DeckTemplateRoot, DeckTemplateVersion, PersonalUser, Visibility, DeckPublicationReview, CopyPublicationReceipt } from "./model";
import type { CompletionStatus } from "../../components/decks/types";
import { isIsoDateOnlyString, addDaysToDateOnly } from "../dateOnly";
import type { MediaItem } from "../media";
import { assertDisposableDatabase } from "./localDatabase";
import { createDefaultCardContent, restoreCreatorCardTitle, restoreCreatorDeckTitle } from "./creatorDefaults";
import { cardPublicationIssue, deckPublicationIssue, deckDraftContent, publicationVisibility, hasVisibilityChange } from "./publicationRules";
import { deckContentHash, type CopyCardCommand, type CopyCardResult } from "./cardReuse";
import { assertForkContext, editedForkContent, inheritForkCardData } from "./forks";
import { assertCardVersionAccess, assertDeckVersionAccess } from "./versionAccess";
import { readablePersonalHistory } from "./personalHistory";
import type { CardForkCommand, DeckForkCommand, ForkContext, ForkDeckEntry } from "./model";

export const COLLECTIONS = { cards: "cardTemplates", cardVersions: "cardTemplateVersions", decks: "deckTemplates", deckVersions: "deckTemplateVersions", users: "users" } as const;
function entityId(value: unknown) { requireCondition(nonblank(value), "INVALID_ENTITY_ID"); }
function draftVisibility(root: { visibility: Visibility; draftVisibility?: Visibility }, requested?: Visibility) {
  requireCondition(requested === undefined || requested === "private" || requested === "public", "INVALID_VISIBILITY");
  const next = requested ?? publicationVisibility(root);
  requireCondition(next === "private" || next === "public", "INVALID_VISIBILITY");
  requireCondition(root.visibility !== "public" || next === "public", "PUBLIC_VISIBILITY_PERMANENT");
  return next;
}
const userKey = (userId: string) => { entityId(userId); return /^[a-f\d]{24}$/i.test(userId) ? new ObjectId(userId) : userId; };
function forkIdentityConflict(error: unknown): never {
  if (error instanceof MongoServerError && error.code === 11000) {
    throw new CardArchitectureError(error.keyPattern?.stepIds ? "STEP_RESERVATION_CONFLICT" : "FORK_RECOVERY_CONFLICT");
  }
  throw error;
}

// Explicit setup only. Never create indexes on module import or through legacy routes.
export async function createFoundationIndexes(db: Db) {
  await db.collection(COLLECTIONS.cards).createIndex({ cardTemplateId: 1 }, { unique: true });
  await db.collection(COLLECTIONS.cards).createIndex({ ownerUserId: 1, cardTemplateId: 1 });
  await db.collection(COLLECTIONS.cards).createIndex({ stepIds: 1 }, { unique: true, partialFilterExpression: { "stepIds.0": { $exists: true } } });
  await db.collection(COLLECTIONS.cardVersions).createIndex({ cardTemplateId: 1, version: 1 }, { unique: true });
  await db.collection(COLLECTIONS.decks).createIndex({ deckTemplateId: 1 }, { unique: true });
  await db.collection(COLLECTIONS.decks).createIndex({ ownerUserId: 1, deckTemplateId: 1 });
  await db.collection(COLLECTIONS.decks).createIndex({ visibility: 1, latestVersion: 1, deckTemplateId: 1 });
  await db.collection(COLLECTIONS.decks).createIndex({ "draft.cards.cardTemplateId": 1, deckTemplateId: 1 });
  await db.collection(COLLECTIONS.deckVersions).createIndex({ deckTemplateId: 1, version: 1 }, { unique: true });
  await db.collection(COLLECTIONS.deckVersions).createIndex({ "content.cards.cardTemplateId": 1, deckTemplateId: 1 });
}

export class CardRepository {
  constructor(readonly db: Db, readonly client: MongoClient) {}
  static async application() { assertDisposableDatabase(); return new CardRepository(await getDatabase(), await getMongoClient()); }
  cards() { return this.db.collection<CardTemplateRoot>(COLLECTIONS.cards); }
  cardVersions() { return this.db.collection<CardTemplateVersion>(COLLECTIONS.cardVersions); }
  decks() { return this.db.collection<DeckTemplateRoot>(COLLECTIONS.decks); }
  deckVersions() { return this.db.collection<DeckTemplateVersion>(COLLECTIONS.deckVersions); }
  users() { return this.db.collection<PersonalUser>(COLLECTIONS.users); }
  transaction<T>(operation: (session: ClientSession) => Promise<T>) { return withMongoTransaction(this.client, operation); }
  getCardVersion(cardTemplateId: string, version: number, session?: ClientSession) {
    entityId(cardTemplateId);
    requireCondition(Number.isInteger(version) && version >= 1, "INVALID_VERSION");
    return this.cardVersions().findOne({ cardTemplateId, version }, { session });
  }
  getDeckVersion(deckTemplateId: string, version: number, session?: ClientSession) {
    entityId(deckTemplateId);
    requireCondition(Number.isInteger(version) && version >= 1, "INVALID_VERSION");
    return this.deckVersions().findOne({ deckTemplateId, version }, { session });
  }
  async cardUpdateNotes(actor: string, cardTemplateId: string, afterVersion: number) {
    entityId(actor); entityId(cardTemplateId);
    requireCondition(Number.isInteger(afterVersion) && afterVersion >= 1, "INVALID_VERSION");
    const root = await this.cards().findOne({ cardTemplateId });
    requireCondition(root && (root.ownerUserId === actor || root.visibility === "public"), "CARD_FORBIDDEN");
    const versions = await this.cardVersions().find({ cardTemplateId, version: { $gt: afterVersion, $lte: root.latestVersion },
      ...(root.ownerUserId === actor ? {} : { visibility: "public" }), updateNote: { $exists: true } }).sort({ version: 1 }).toArray();
    return versions.filter((version) => version.updateNote?.trim()).map(({ version, updateNote }) => ({ version, updateNote: updateNote! }));
  }
  getPersonalUser(userId: string, session?: ClientSession) {
    return this.users().findOne({ _id: userKey(userId) }, { projection: { decksData: 1, cardsData: 1 }, session });
  }
  private async ownerCard(actor: string, cardTemplateId: string, expectedRevision: number, session: ClientSession) {
    entityId(actor); entityId(cardTemplateId);
    const root = await this.cards().findOne({ cardTemplateId }, { session });
    requireCondition(root?.ownerUserId === actor, "CARD_FORBIDDEN");
    requireCondition(root.revision === expectedRevision, "STALE_REVISION"); return root;
  }
  private async ownerDeck(actor: string, deckTemplateId: string, expectedRevision: number, session: ClientSession) {
    entityId(actor); entityId(deckTemplateId);
    const root = await this.decks().findOne({ deckTemplateId }, { session });
    requireCondition(root?.ownerUserId === actor, "DECK_FORBIDDEN");
    requireCondition(root.revision === expectedRevision, "STALE_REVISION"); return root;
  }
  private async assertUser(userId: string, session?: ClientSession) {
    const user = await this.getPersonalUser(userId, session);
    requireCondition(user && Array.isArray(user.decksData) && Array.isArray(user.cardsData), "NEW_MODEL_USER_REQUIRED");
    requireCondition(user.decksData.every((deck) => !Object.hasOwn(deck, "cards")), "LEGACY_USER_REFUSED");
    for (const deck of user.decksData) assertAdoption(deck.deckTemplateVersion);
    for (const card of user.cardsData) assertAdoption(card.cardTemplateVersion);
    return user;
  }
  private async deckReferences(actor: string, content: DeckContent, session: ClientSession) {
    const roots = await this.cards().find({ cardTemplateId: { $in: content.cards.map((ref) => ref.cardTemplateId) } }, { session }).toArray();
    requireCondition(roots.length === content.cards.length, "MISSING_CARD_REFERENCE");
    requireCondition(roots.every((card) => card.ownerUserId === actor || card.visibility === "public"), "PRIVATE_FOREIGN_CARD");
    requireCondition(roots.every((card) => card.ownerUserId === actor || card.latestVersion >= 1), "UNPUBLISHED_FOREIGN_CARD"); return roots;
  }
  private async recordReferenceChanges(deckTemplateId: string, ids: string[], session: ClientSession) {
    if (!ids.length) return;
    // Both first attachment and reuse write the Card root. Concurrent attachments
    // cannot both conclude that they are exclusive from separate snapshots.
    await this.cards().updateMany({ cardTemplateId: { $in: ids } }, { $inc: { referenceRevision: 1 } }, { session });
    const drafts = await this.decks().find({ deckTemplateId: { $ne: deckTemplateId }, "draft.cards.cardTemplateId": { $in: ids } },
      { session, projection: { "draft.cards": 1 } }).toArray();
    const history = await this.deckVersions().find({ deckTemplateId: { $ne: deckTemplateId }, "content.cards.cardTemplateId": { $in: ids } },
      { session, projection: { "content.cards": 1 } }).toArray();
    const reused = new Set([...drafts.flatMap((root) => root.draft!.cards), ...history.flatMap((version) => version.content.cards)].map((ref) => ref.cardTemplateId));
    await this.cards().updateMany({ cardTemplateId: { $in: ids.filter((id) => reused.has(id)) }, firstReusedAt: { $exists: false } },
      { $set: { firstReusedAt: new Date() } }, { session });
  }
  async copyOwnedCard(actor: string, cardTemplateId: string, command: CopyCardCommand): Promise<CopyCardResult> {
    entityId(actor); entityId(cardTemplateId); entityId(command.deckTemplateId);
    requireCondition(Number.isInteger(command.revision) && command.revision >= 0 && typeof command.contentHash === "string" && /^[a-f0-9]{64}$/.test(command.contentHash), "INVALID_COPY_COMMAND");
    return this.transaction(async (session) => {
      const source = await this.cards().findOne({ cardTemplateId }, { session });
      requireCondition(source?.ownerUserId === actor, "CARD_FORBIDDEN");
      const deck = await this.decks().findOne({ deckTemplateId: command.deckTemplateId }, { session });
      requireCondition(deck?.ownerUserId === actor, "DECK_FORBIDDEN");
      const latest = deck.latestVersion >= 1 ? await this.getDeckVersion(deck.deckTemplateId, deck.latestVersion, session) : null;
      const current = deck.draft ?? (latest ? deckDraftContent(latest.content) : null);
      requireCondition(current, "MISSING_DECK_CONTENT");
      const present = current.cards.some((ref) => ref.cardTemplateId === cardTemplateId);
      if (present) {
        const before = { ...current, cards: current.cards.slice(0, -1) };
        // Recover only this exact committed outcome. In particular, a later
        // ordinary publication of a draft-only Copy is not auto-publication.
        const receipt = { cardTemplateId, revision: command.revision, contentHash: command.contentHash };
        const published = deck.draft === null && deck.revision === command.revision + 2
          && isDeepStrictEqual(latest?.copyReceipt, receipt);
        const draft = deck.draft !== null && deck.revision === command.revision + 1;
        requireCondition((published || draft) && current.cards.at(-1)?.cardTemplateId === cardTemplateId
          && deckContentHash(before) === command.contentHash && source.firstReusedAt, "COPY_CARD_RECOVERY_CONFLICT");
        const ack = { deckTemplateId: deck.deckTemplateId, revision: deck.revision, firstReusedAt: source.firstReusedAt };
        return published ? { ...ack, outcome: "published", publishedVersion: deck.latestVersion }
          : { ...ack, outcome: "draft", publishedVersion: null };
      }
      requireCondition(deck.revision === command.revision, "STALE_REVISION");
      requireCondition(deckContentHash(current) === command.contentHash, "COPY_CARD_RECOVERY_CONFLICT");
      const next = { ...current, cards: [...current.cards, { cardTemplateId }] };
      assertDeckContent(next);
      const cards = await this.deckReferences(actor, next, session);
      // Capture cleanliness BEFORE the append. Card drafts do not make the Deck
      // dirty, and publication below uses only their immutable published versions.
      const shouldPublish = deck.latestVersion >= 1 && deck.draft === null && !hasVisibilityChange(deck) && source.latestVersion >= 1
        && await this.deckPublicationPrerequisite({ ...deck, draft: next }, cards, session) === null;
      await this.recordReferenceChanges(deck.deckTemplateId, [cardTemplateId], session);
      const now = new Date();
      await this.cards().updateOne({ cardTemplateId, firstReusedAt: { $exists: false } }, { $set: { firstReusedAt: now } }, { session });
      const saved = await this.decks().updateOne({ deckTemplateId: deck.deckTemplateId, revision: command.revision },
        { $set: { draft: next, updatedAt: now }, $inc: { revision: 1 } }, { session });
      requireCondition(saved.matchedCount === 1, "STALE_REVISION");
      const publishedVersion = shouldPublish ? await this.publishDeckInSession(actor, deck.deckTemplateId, command.revision + 1, session,
        undefined, undefined, { cardTemplateId, revision: command.revision, contentHash: command.contentHash }) : null;
      const marked = await this.cards().findOne({ cardTemplateId }, { session, projection: { firstReusedAt: 1 } });
      const ack = { deckTemplateId: deck.deckTemplateId, revision: command.revision + (publishedVersion === null ? 1 : 2), firstReusedAt: marked!.firstReusedAt! };
      return publishedVersion === null ? { ...ack, outcome: "draft", publishedVersion: null }
        : { ...ack, outcome: "published", publishedVersion };
    });
  }
  private async forkView(actor: string, context: ForkContext, session: ClientSession) {
    assertForkContext(context);
    const user = await this.assertUser(actor, session);
    if (context.kind === "library") return { user, deck: null };
    const data = user.decksData.find((data) => data.deckTemplateId === context.deckTemplateId);
    requireCondition(data, "FORK_OUTSIDE_PERSONAL_CONTEXT");
    const root = await this.decks().findOne({ deckTemplateId: data.deckTemplateId }, { session });
    requireCondition(root && (root.ownerUserId === actor || root.visibility === "public"), "DECK_FORBIDDEN");
    const deck = await this.getDeckVersion(data.deckTemplateId, data.deckTemplateVersion, session);
    requireCondition(deck, "MISSING_DECK_VERSION");
    assertDeckVersionAccess(actor, root, deck);
    return { user, deck };
  }
  private async cardForkInSession(actor: string, command: CardForkCommand, session: ClientSession) {
    entityId(command.cardTemplateId); entityId(command.source?.cardTemplateId); assertAdoption(command.source?.version);
    const { user, deck } = await this.forkView(actor, command.context, session);
    const source = await this.cards().findOne({ cardTemplateId: command.source.cardTemplateId }, { session });
    requireCondition(source && (source.ownerUserId === actor || source.visibility === "public"), "CARD_FORBIDDEN");
    const version = await this.getCardVersion(source.cardTemplateId, command.source.version, session);
    requireCondition(version && version.version <= source.latestVersion, "MISSING_CARD_VERSION");
    assertCardVersionAccess(actor, source, version);
    if (deck) {
      const ref = deck.content.cards.find((ref) => ref.cardTemplateId === source.cardTemplateId);
      const data = user.cardsData.find((data) => data.cardTemplateId === source.cardTemplateId);
      requireCondition(ref && (data?.cardTemplateVersion ?? ref.cardVersionAtPublish) === version.version, "FORK_OUTSIDE_PERSONAL_CONTEXT");
    }
    const content = editedForkContent(version.content, command.source, command.stepIds, command.content);
    const existing = await this.cards().findOne({ cardTemplateId: command.cardTemplateId }, { session });
    if (existing) {
      requireCondition(existing.ownerUserId === actor && existing.latestVersion === 0 && existing.revision === 0
        && isDeepStrictEqual(existing.forkedFrom, command.source) && isDeepStrictEqual(existing.forkContext, command.context)
        && isDeepStrictEqual(existing.draft, content) && isDeepStrictEqual(existing.stepIds, command.stepIds), "CARD_FORK_RECOVERY_CONFLICT");
      return existing;
    }
    const now = new Date();
    const root: CardTemplateRoot = { cardTemplateId: command.cardTemplateId, ownerUserId: actor, visibility: "private",
      latestVersion: 0, draft: content, stepIds: [...command.stepIds], revision: 0, forkedFrom: command.source,
      forkContext: command.context, createdAt: now, updatedAt: now };
    // The global multikey unique index reserves all new Step identities here.
    await this.cards().insertOne(root, { session }); return root;
  }
  async createCardFork(actor: string, command: CardForkCommand) {
    if (command.attachTo) {
      entityId(command.attachTo.deckTemplateId);
      requireCondition(Number.isInteger(command.attachTo.revision) && command.attachTo.revision >= 0, "INVALID_REVISION");
    }
    return this.transaction(async (session) => {
      const card = await this.cardForkInSession(actor, command, session);
      let deckRevision: number | null = null;
      if (command.attachTo) {
        const attach = command.attachTo; assertDeckContent(attach.nextDeckContent);
        const deck = await this.decks().findOne({ deckTemplateId: attach.deckTemplateId }, { session });
        requireCondition(deck?.ownerUserId === actor, "DECK_FORBIDDEN");
        if (deck.revision === attach.revision + 1 && isDeepStrictEqual(deck.draft, attach.nextDeckContent)) {
          requireCondition(deck.draft!.cards.some((ref) => ref.cardTemplateId === card.cardTemplateId), "CARD_FORK_RECOVERY_CONFLICT");
          deckRevision = deck.revision;
        } else {
          requireCondition(deck.revision === attach.revision, "STALE_REVISION");
          const latest = deck.latestVersion ? await this.getDeckVersion(deck.deckTemplateId, deck.latestVersion, session) : null;
          const current = deck.draft ?? (latest ? deckDraftContent(latest.content) : null);
          requireCondition(current && current.cards.some((ref) => ref.cardTemplateId === command.source.cardTemplateId), "CARD_OUTSIDE_DECK");
          const next = { ...current, cards: current.cards.map((ref) => ref.cardTemplateId === command.source.cardTemplateId ? { cardTemplateId: card.cardTemplateId } : ref) };
          requireCondition(isDeepStrictEqual(next, attach.nextDeckContent), "INVALID_FORK_ATTACHMENT");
          await this.deckReferences(actor, next, session);
          await this.recordReferenceChanges(deck.deckTemplateId, [command.source.cardTemplateId, card.cardTemplateId], session);
          const saved = await this.decks().updateOne({ deckTemplateId: deck.deckTemplateId, revision: attach.revision }, {
            $set: { draft: next, updatedAt: new Date() }, $inc: { revision: 1 },
          }, { session }); requireCondition(saved.matchedCount === 1, "STALE_REVISION");
          deckRevision = attach.revision + 1;
        }
      }
      return { cardTemplateId: card.cardTemplateId, cardRevision: card.revision, deckRevision };
    }).catch(forkIdentityConflict);
  }
  async createDeckFork(actor: string, command: DeckForkCommand) {
    entityId(command.deckTemplateId); entityId(command.source?.deckTemplateId); assertAdoption(command.source?.version); assertDeckContent(command.content);
    return this.transaction(async (session) => {
      const view = await this.forkView(actor, command.context, session);
      const source = await this.decks().findOne({ deckTemplateId: command.source.deckTemplateId }, { session });
      requireCondition(source && (source.ownerUserId === actor || source.visibility === "public"), "DECK_FORBIDDEN");
      const version = await this.getDeckVersion(source.deckTemplateId, command.source.version, session);
      requireCondition(version && version.version <= source.latestVersion, "MISSING_DECK_VERSION");
      assertDeckVersionAccess(actor, source, version);
      requireCondition(!view.deck || view.deck.deckTemplateId === source.deckTemplateId && view.deck.version === version.version, "FORK_OUTSIDE_PERSONAL_CONTEXT");
      let content = command.content, cardRevision: number | null = null;
      if (command.cardFork) {
        requireCondition(!command.cardFork.attachTo && isDeepStrictEqual(command.cardFork.context, command.context)
          && version.content.cards.some((ref) => ref.cardTemplateId === command.cardFork!.source.cardTemplateId)
          && content.cards.some((ref) => ref.cardTemplateId === command.cardFork!.source.cardTemplateId), "INVALID_COMBINED_FORK");
        const card = await this.cardForkInSession(actor, command.cardFork, session);
        cardRevision = card.revision;
        content = { ...content, cards: content.cards.map((ref) => ref.cardTemplateId === command.cardFork!.source.cardTemplateId ? { cardTemplateId: card.cardTemplateId } : ref) };
      }
      assertDeckContent(content);
      requireCondition(!isDeepStrictEqual(content, deckDraftContent(version.content)), "NO_MEANINGFUL_FORK_EDIT");
      await this.deckReferences(actor, content, session);
      const existing = await this.decks().findOne({ deckTemplateId: command.deckTemplateId }, { session });
      if (existing) {
        requireCondition(existing.ownerUserId === actor && existing.latestVersion === 0 && existing.revision === 0
          && isDeepStrictEqual(existing.forkedFrom, command.source) && isDeepStrictEqual(existing.forkContext, command.context)
          && isDeepStrictEqual(existing.draft, content), "DECK_FORK_RECOVERY_CONFLICT");
      } else {
        const now = new Date();
        await this.recordReferenceChanges(command.deckTemplateId, content.cards.map((ref) => ref.cardTemplateId), session);
        await this.decks().insertOne({ deckTemplateId: command.deckTemplateId, ownerUserId: actor, visibility: "private", latestVersion: 0,
          draft: content, revision: 0, forkedFrom: command.source, forkContext: command.context, createdAt: now, updatedAt: now }, { session });
      }
      return { deckTemplateId: command.deckTemplateId, deckRevision: 0, cardRevision };
    }).catch(forkIdentityConflict);
  }
  // Stable caller-generated IDs make an interrupted first save safely retryable.
  async createPrivateGraph(actor: string, deckTemplateId: string, content: DeckContent,
    cards: { cardTemplateId: string; content: CardContent }[]) {
    entityId(deckTemplateId); assertDeckContent(content);
    requireCondition(Array.isArray(cards) && cards.length === content.cards.length && cards.every((card) => card && typeof card === "object") && new Set(cards.map((card) => card.cardTemplateId)).size === cards.length, "INVALID_INITIAL_GRAPH");
    for (const card of cards) { entityId(card.cardTemplateId); assertCardContent(card.content);
      requireCondition(card.content.steps.every((step) => step.forkedFrom === undefined), "FORK_OPERATION_REQUIRED"); }
    requireCondition(content.cards.every((ref) => cards.some((card) => card.cardTemplateId === ref.cardTemplateId)), "INVALID_INITIAL_GRAPH");
    return this.transaction(async (session) => {
      await this.assertUser(actor, session);
      const existing = await this.decks().findOne({ deckTemplateId }, { session });
      if (existing) {
        requireCondition(existing.ownerUserId === actor && existing.latestVersion === 0 && isDeepStrictEqual(existing.draft, content), "INITIAL_GRAPH_CONFLICT");
        for (const card of cards) {
          const root = await this.cards().findOne({ cardTemplateId: card.cardTemplateId }, { session });
          requireCondition(root?.ownerUserId === actor && root.latestVersion === 0 && isDeepStrictEqual(root.draft, card.content), "INITIAL_GRAPH_CONFLICT");
        }
        return;
      }
      const now = new Date();
      for (const card of cards) await this.cards().insertOne({ cardTemplateId: card.cardTemplateId, ownerUserId: actor,
        visibility: "private", latestVersion: 0, draft: card.content, stepIds: card.content.steps.map((step) => step.stepId),
        revision: 0, forkedFrom: null, createdAt: now, updatedAt: now }, { session });
      const root: DeckTemplateRoot = { deckTemplateId, ownerUserId: actor, visibility: "private", latestVersion: 0,
        draft: content, revision: 0, forkedFrom: null, createdAt: now, updatedAt: now };
      await this.decks().insertOne(root, { session });
    });
  }
  async createCardDraft(actor: string, content: CardContent, visibility: Visibility = "private", cardTemplateId: string = randomUUID()) {
    entityId(cardTemplateId);
    assertCardContent(content); requireCondition(["public", "private"].includes(visibility), "INVALID_VISIBILITY");
    requireCondition(content.steps.every((step) => step.forkedFrom === undefined), "FORK_OPERATION_REQUIRED");
    const now = new Date();
    const root: CardTemplateRoot = { cardTemplateId, ownerUserId: actor, visibility: "private", ...(visibility === "public" ? { draftVisibility: visibility } : {}), latestVersion: 0,
      draft: structuredClone(content), stepIds: content.steps.map((step) => step.stepId), revision: 0, forkedFrom: null, createdAt: now, updatedAt: now };
    const existing = await this.transaction(async (session) => {
      await this.assertUser(actor, session);
      const existing = await this.cards().findOne({ cardTemplateId }, { session });
      if (existing) { requireCondition(existing.ownerUserId === actor && existing.latestVersion === 0 && publicationVisibility(existing) === visibility && isDeepStrictEqual(existing.draft, content), "INITIAL_CARD_CONFLICT"); return existing; }
      await this.cards().insertOne(root, { session }); return root;
    });
    return existing;
  }
  async createAndAttachCard(actor: string, command: CreateAndAttachCardCommand) {
    const { deckTemplateId, expectedDeckRevision, cardTemplateId, stepIds, nextDeckContent } = command;
    entityId(actor); entityId(deckTemplateId); entityId(cardTemplateId);
    requireCondition(Number.isInteger(expectedDeckRevision) && expectedDeckRevision >= 0, "INVALID_REVISION");
    requireCondition(Array.isArray(stepIds), "INVALID_STEP");
    const content = createDefaultCardContent(stepIds);
    assertCardContent(content); assertDeckContent(nextDeckContent);
    requireCondition(nextDeckContent.cards.some((ref) => ref.cardTemplateId === cardTemplateId), "NEW_CARD_REFERENCE_REQUIRED");
    return this.transaction(async (session) => {
      await this.assertUser(actor, session);
      const deck = await this.decks().findOne({ deckTemplateId }, { session });
      requireCondition(deck?.ownerUserId === actor, "DECK_FORBIDDEN");
      const existing = await this.cards().findOne({ cardTemplateId }, { session });
      const published = deck.latestVersion >= 1 ? await this.getDeckVersion(deckTemplateId, deck.latestVersion, session) : null;
      requireCondition(deck.latestVersion === 0 || published !== null, "MISSING_DECK_VERSION");
      const publishedContent = published ? deckDraftContent(published.content) : null;
      if (existing) {
        // Recognize only the exact post-commit state. Subsequent edits/publication
        // require explicit recovery; never guess or reattach after another tab removes it.
        requireCondition(deck.revision === expectedDeckRevision + 1 && isDeepStrictEqual(deck.draft, nextDeckContent)
          && existing.ownerUserId === actor && existing.visibility === "private" && existing.latestVersion === 0
          && existing.revision === 0 && existing.forkedFrom === null && isDeepStrictEqual(existing.draft, content)
          && isDeepStrictEqual(existing.stepIds, stepIds), "ADD_CARD_RECOVERY_CONFLICT");
        const { _id: deckMongoId, ...deckRoot } = deck; void deckMongoId;
        const { _id: cardMongoId, ...cardRoot } = existing; void cardMongoId;
        return { deck: { root: deckRoot, content: deck.draft!, publishedContent }, card: { root: cardRoot, content, publishedContent: null } };
      }
      requireCondition(deck.revision === expectedDeckRevision, "STALE_REVISION");
      await this.deckReferences(actor, { ...nextDeckContent, cards: nextDeckContent.cards.filter((ref) => ref.cardTemplateId !== cardTemplateId) }, session);
      const now = new Date();
      const cardRoot: CardTemplateRoot = { cardTemplateId, ownerUserId: actor, visibility: "private", latestVersion: 0,
        draft: content, stepIds: [...stepIds], revision: 0, forkedFrom: null, createdAt: now, updatedAt: now };
      await this.cards().insertOne({ ...cardRoot }, { session });
      const beforeIds = (deck.draft ?? publishedContent)!.cards.map((ref) => ref.cardTemplateId);
      const nextIds = nextDeckContent.cards.map((ref) => ref.cardTemplateId);
      await this.recordReferenceChanges(deckTemplateId, [...beforeIds.filter((id) => !nextIds.includes(id)),
        ...nextIds.filter((id) => id !== cardTemplateId && !beforeIds.includes(id))], session);
      const result = await this.decks().updateOne({ deckTemplateId, revision: expectedDeckRevision }, {
        $set: { draft: nextDeckContent, updatedAt: now }, $inc: { revision: 1 },
      }, { session });
      requireCondition(result.matchedCount === 1, "STALE_REVISION");
      const { _id, ...deckRoot } = deck; void _id;
      return { deck: { root: { ...deckRoot, draft: nextDeckContent, revision: expectedDeckRevision + 1, updatedAt: now },
        content: nextDeckContent, publishedContent }, card: { root: cardRoot, content, publishedContent: null } };
    }).catch((error: unknown) => {
      if (error instanceof MongoServerError && error.code === 11000) {
        throw new CardArchitectureError(error.keyPattern?.stepIds ? "STEP_RESERVATION_CONFLICT" : "ADD_CARD_RECOVERY_CONFLICT");
      }
      throw error;
    });
  }
  async createDeckDraft(actor: string, content: DeckContent, visibility: Visibility = "private") {
    assertDeckContent(content); requireCondition(["public", "private"].includes(visibility), "INVALID_VISIBILITY");
    const now = new Date(); const root: DeckTemplateRoot = { deckTemplateId: randomUUID(), ownerUserId: actor, visibility: "private", ...(visibility === "public" ? { draftVisibility: visibility } : {}),
      latestVersion: 0, draft: structuredClone(content), revision: 0, forkedFrom: null, createdAt: now, updatedAt: now };
    await this.transaction(async (session) => {
      await this.assertUser(actor, session); await this.deckReferences(actor, content, session);
      await this.recordReferenceChanges(root.deckTemplateId, content.cards.map((ref) => ref.cardTemplateId), session);
      await this.decks().insertOne(root, { session });
    }); return root;
  }
  async saveCardDraft(actor: string, cardTemplateId: string, expectedRevision: number, content: CardContent, visibility?: Visibility) {
    assertCardContent(content);
    return this.transaction(async (session) => {
      const root = await this.ownerCard(actor, cardTemplateId, expectedRevision, session);
      const nextVisibility = draftVisibility(root, visibility);
      const latest = root.latestVersion >= 1 ? await this.getCardVersion(cardTemplateId, root.latestVersion, session) : null;
      requireCondition(root.latestVersion === 0 || latest !== null, "MISSING_CARD_VERSION");
      const current = root.draft ?? latest?.content;
      for (const step of content.steps) {
        const previous = current?.steps.find((item) => item.stepId === step.stepId) ?? latest?.content.steps.find((item) => item.stepId === step.stepId);
        requireCondition(isDeepStrictEqual(step.forkedFrom, previous?.forkedFrom), "STEP_LINEAGE_IMMUTABLE");
      }
      // An explicit clearing edit restores the published/default title. An already
      // stored blank title is not rewritten by an unrelated content edit.
      const saved = !content.intro.title?.trim() && content.intro.title !== current?.intro.title
        ? { ...content, intro: { ...content.intro, title: restoreCreatorCardTitle(content.intro.title, latest?.content.intro.title) } } : content;
      const draft = nextVisibility === root.visibility && latest && isDeepStrictEqual(saved, latest.content) ? null : saved;
      const stepIds = [...new Set([...root.stepIds, ...content.steps.map((step) => step.stepId)])];
      // A root retains historical identities; no other Card may claim them.
      const result = await this.cards().updateOne({ cardTemplateId, revision: expectedRevision }, {
        $set: { draft, stepIds, ...(nextVisibility !== root.visibility ? { draftVisibility: nextVisibility } : {}), updatedAt: new Date() },
        ...(nextVisibility === root.visibility ? { $unset: { draftVisibility: "" } } : {}), $inc: { revision: 1 },
      }, { session }); requireCondition(result.matchedCount === 1, "STALE_REVISION"); return expectedRevision + 1;
    });
  }
  async saveDeckDraft(actor: string, deckTemplateId: string, expectedRevision: number, content: DeckContent, visibility?: Visibility) {
    assertDeckContent(content);
    return this.transaction(async (session) => {
      const root = await this.ownerDeck(actor, deckTemplateId, expectedRevision, session);
      const nextVisibility = draftVisibility(root, visibility);
      await this.deckReferences(actor, content, session);
      const latest = root.latestVersion >= 1 ? await this.getDeckVersion(deckTemplateId, root.latestVersion, session) : null;
      requireCondition(root.latestVersion === 0 || latest !== null, "MISSING_DECK_VERSION");
      const publishedContent = latest ? deckDraftContent(latest.content) : null;
      const current = root.draft ?? publishedContent;
      const saved = !content.title.trim() && content.title !== current?.title
        ? { ...content, title: restoreCreatorDeckTitle(content.title, latest?.content.title) } : content;
      const previousIds = current?.cards.map((ref) => ref.cardTemplateId) ?? [], nextIds = content.cards.map((ref) => ref.cardTemplateId);
      const changedIds = [...new Set([...previousIds.filter((id) => !nextIds.includes(id)), ...nextIds.filter((id) => !previousIds.includes(id))])];
      await this.recordReferenceChanges(deckTemplateId, changedIds, session);
      const visibilityChanged = nextVisibility !== root.visibility;
      const draft = !visibilityChanged && latest && isDeepStrictEqual(saved, publishedContent) ? null : saved;
      const result = await this.decks().updateOne({ deckTemplateId, revision: expectedRevision }, {
        $set: { draft, ...(visibilityChanged ? { draftVisibility: nextVisibility } : {}), updatedAt: new Date() },
        ...(!visibilityChanged ? { $unset: { draftVisibility: "" } } : {}), $inc: { revision: 1 },
      }, { session }); requireCondition(result.matchedCount === 1, "STALE_REVISION"); return expectedRevision + 1;
    });
  }
  private note(updateNote?: string) {
    requireCondition(updateNote === undefined || (typeof updateNote === "string" && updateNote.length <= 2000), "INVALID_UPDATE_NOTE");
    return updateNote?.trim() ? { updateNote: updateNote.trim() } : {};
  }
  async publishCard(actor: string, cardTemplateId: string, expectedRevision: number, updateNote?: string) {
    entityId(actor); entityId(cardTemplateId);
    requireCondition(Number.isInteger(expectedRevision) && expectedRevision >= 0, "INVALID_REVISION");
    const note = this.note(updateNote);
    return this.transaction(async (session) => {
      const existing = await this.cards().findOne({ cardTemplateId }, { session });
      requireCondition(existing?.ownerUserId === actor, "CARD_FORBIDDEN");
      if (existing.forkedFrom && existing.latestVersion >= 1) {
        const first = await this.getCardVersion(cardTemplateId, 1, session);
        if (first?.forkPublicationReceipt?.revision === expectedRevision) {
          requireCondition(first.publishedByUserId === actor && first.updateNote === note.updateNote, "FORK_PUBLICATION_RECOVERY_CONFLICT");
          return 1; // Never repeat inheritance, even after target personal state changes.
        }
      }
      const root = existing;
      requireCondition(root.revision === expectedRevision, "STALE_REVISION");
      requireCondition(root.draft !== null, "NO_UNPUBLISHED_CHANGES"); assertCardContent(root.draft);
      const user = await this.assertUser(actor, session);
      const latest = root.latestVersion >= 1 ? await this.getCardVersion(cardTemplateId, root.latestVersion, session) : null;
      const visibility = draftVisibility(root);
      const issue = cardPublicationIssue(root.latestVersion, root.draft, latest?.content ?? null, root);
      requireCondition(issue === null, issue ?? "NO_UNPUBLISHED_CHANGES");
      const version = root.latestVersion + 1; const now = new Date();
      await this.cardVersions().insertOne({ cardTemplateId, version, content: root.draft, visibility, ...note,
        ...(version === 1 && root.forkedFrom ? { forkPublicationReceipt: { revision: expectedRevision } } : {}), publishedAt: now, publishedByUserId: actor }, { session });
      const result = await this.cards().updateOne({ cardTemplateId, revision: expectedRevision }, { $set: { latestVersion: version, visibility, draft: null, updatedAt: now }, $unset: { draftVisibility: "" }, $inc: { revision: 1 } }, { session });
      requireCondition(result.matchedCount === 1, "STALE_REVISION");
      if (version === 1 && root.forkedFrom) {
        requireCondition(!user.cardsData.some((data) => data.cardTemplateId === cardTemplateId), "FORK_TARGET_DATA_CONFLICT");
        const sources = user.cardsData.filter((data) => data.cardTemplateId === root.forkedFrom!.cardTemplateId);
        requireCondition(sources.length <= 1, "AMBIGUOUS_CARD_DATA");
        if (sources.length) {
          const source = await this.getCardVersion(root.forkedFrom.cardTemplateId, root.forkedFrom.version, session);
          const adopted = await this.getCardVersion(root.forkedFrom.cardTemplateId, sources[0].cardTemplateVersion, session);
          requireCondition(source && adopted, "MISSING_CARD_VERSION");
          const data = inheritForkCardData(cardTemplateId, root.draft, root.forkedFrom, source.content, adopted.content,
            sources[0], now);
          await this.users().updateOne({ _id: userKey(actor), "cardsData.cardTemplateId": { $ne: cardTemplateId } }, { $push: { cardsData: data } }, { session });
        }
      }
      // Field-level update: no reconciliation, replacement, deletion or follower adoption.
      await this.users().updateOne({ _id: userKey(actor), "cardsData.cardTemplateId": cardTemplateId }, {
        $set: { "cardsData.$[card].cardTemplateVersion": version, "cardsData.$[card].updatedAt": now },
      }, { session, arrayFilters: [{ "card.cardTemplateId": cardTemplateId }] }); return version;
    });
  }
  private publicationReview(root: DeckTemplateRoot, cards: CardTemplateRoot[]): DeckPublicationReview {
    return { deckTemplateId: root.deckTemplateId, revision: root.revision, cards: root.draft!.cards.map(({ cardTemplateId }) => {
      const card = cards.find((card) => card.cardTemplateId === cardTemplateId)!;
      return { cardTemplateId, revision: card.revision, latestVersion: card.latestVersion, hasDraft: card.draft !== null };
    }) };
  }
  async prepareDeckPublication(actor: string, deckTemplateId: string, expectedRevision: number) {
    return this.transaction(async (session) => {
      const root = await this.ownerDeck(actor, deckTemplateId, expectedRevision, session);
      requireCondition(root.draft !== null, "NO_UNPUBLISHED_CHANGES");
      const cards = await this.deckReferences(actor, root.draft, session);
      const latest = root.latestVersion ? await this.getDeckVersion(deckTemplateId, root.latestVersion, session) : null;
      draftVisibility(root);
      const issue = deckPublicationIssue(root.latestVersion, root.draft, latest ? deckDraftContent(latest.content) : null, cards, root);
      requireCondition(issue === null, issue ?? "NO_UNPUBLISHED_CHANGES");
      return this.publicationReview(root, cards);
    });
  }
  private async deckPublicationPrerequisite(root: DeckTemplateRoot, cards: CardTemplateRoot[], session: ClientSession): Promise<string | null> {
    const latest = root.latestVersion >= 1 ? await this.getDeckVersion(root.deckTemplateId, root.latestVersion, session) : null;
    const issue = deckPublicationIssue(root.latestVersion, root.draft, latest ? deckDraftContent(latest.content) : null, cards, root);
    if (issue) return issue;
    const versions = cards.length ? await this.cardVersions().find({ $or: cards.map((card) => ({ cardTemplateId: card.cardTemplateId, version: card.latestVersion })) }, { session }).toArray() : [];
    return versions.length === cards.length ? null : "MISSING_CARD_VERSION";
  }
  async publishDeck(actor: string, deckTemplateId: string, expectedRevision: number, updateNote?: string,
    consent?: { review: DeckPublicationReview; acceptCardDrafts: boolean }, forkEntry?: ForkDeckEntry) {
    return this.transaction((session) => this.publishDeckInSession(actor, deckTemplateId, expectedRevision, session, updateNote, consent, undefined, forkEntry));
  }
  // Same publication rules/adoption writes for explicit Publish and atomic Copy.
  // Never start a nested transaction or catch a partial publication as draft-only.
  private async publishDeckInSession(actor: string, deckTemplateId: string, expectedRevision: number, session: ClientSession,
    updateNote?: string, consent?: { review: DeckPublicationReview; acceptCardDrafts: boolean }, copyReceipt?: CopyPublicationReceipt, forkEntry?: ForkDeckEntry) {
    entityId(actor); entityId(deckTemplateId);
    requireCondition(Number.isInteger(expectedRevision) && expectedRevision >= 0, "INVALID_REVISION");
    if (forkEntry !== undefined) requireCondition(forkEntry !== null && typeof forkEntry.enterMyDecks === "boolean" && Object.keys(forkEntry).length === 1, "INVALID_FORK_ENTRY");
    const existing = await this.decks().findOne({ deckTemplateId }, { session });
    requireCondition(existing?.ownerUserId === actor, "DECK_FORBIDDEN");
    if (existing.forkedFrom && existing.latestVersion >= 1) {
      const first = await this.getDeckVersion(deckTemplateId, 1, session);
      if (first?.forkPublicationReceipt?.revision === expectedRevision) {
        requireCondition(first.forkPublicationReceipt.enterMyDecks === forkEntry?.enterMyDecks
          && first.updateNote === this.note(updateNote).updateNote
          && isDeepStrictEqual(first.forkPublicationReceipt.review, consent?.review)
          && first.forkPublicationReceipt.acceptCardDrafts === consent?.acceptCardDrafts, "FORK_PUBLICATION_RECOVERY_CONFLICT");
        return 1;
      }
    }
    const root = existing;
    requireCondition(root.revision === expectedRevision, "STALE_REVISION");
    const visibility = draftVisibility(root);
    requireCondition(!root.forkedFrom || root.latestVersion > 0 || forkEntry !== undefined, "FORK_ENTRY_REQUIRED");
    requireCondition(root.draft !== null, "NO_UNPUBLISHED_CHANGES"); assertDeckContent(root.draft);
    const cards = await this.deckReferences(actor, root.draft, session);
    if (consent) {
      requireCondition(isDeepStrictEqual(consent.review, this.publicationReview(root, cards)), "DECK_PUBLICATION_REVIEW_CONFLICT");
      requireCondition(!cards.some((card) => card.draft !== null) || consent.acceptCardDrafts === true, "CARD_DRAFT_CONFIRMATION_REQUIRED");
    }
    const issue = await this.deckPublicationPrerequisite(root, cards, session);
    requireCondition(issue === null, issue ?? "NO_UNPUBLISHED_CHANGES");
    const now = new Date();
    const byId = new Map(cards.map((card) => [card.cardTemplateId, card])); const version = root.latestVersion + 1;
    await this.deckVersions().insertOne({ deckTemplateId, version, content: { ...root.draft,
      cards: root.draft.cards.map(({ cardTemplateId }) => ({ cardTemplateId, cardVersionAtPublish: byId.get(cardTemplateId)!.latestVersion })),
    }, visibility, ...this.note(updateNote), ...(copyReceipt ? { copyReceipt } : {}),
    ...(root.forkedFrom && version === 1 ? { forkPublicationReceipt: { revision: expectedRevision, enterMyDecks: forkEntry!.enterMyDecks,
      ...(consent ? { review: consent.review, acceptCardDrafts: consent.acceptCardDrafts } : {}) } } : {}),
    publishedAt: now, publishedByUserId: actor }, { session });
    const result = await this.decks().updateOne({ deckTemplateId, revision: expectedRevision }, { $set: { latestVersion: version, visibility, draft: null, updatedAt: now }, $unset: { draftVisibility: "" }, $inc: { revision: 1 } }, { session });
    requireCondition(result.matchedCount === 1, "STALE_REVISION");
    const user = await this.assertUser(actor, session);
    const membership = user.decksData.find((data) => data.deckTemplateId === deckTemplateId);
    // Ordinary private first publication is also personal entry. Fork entry
    // remains explicit; public publication alone never creates membership.
    const firstPrivateEntry = root.latestVersion === 0 && visibility === "private" && root.forkedFrom === null;
    const forkPersonalEntry = root.forkedFrom !== null && version === 1 && forkEntry?.enterMyDecks === true;
    if (membership || firstPrivateEntry || forkPersonalEntry) {
      await this.ensureCompositionCardData(actor, user, root.draft.cards, now, session);
      if (!membership) {
        await this.ensureDeckDataInSession(actor, root, version, now, session);
        if (forkPersonalEntry && root.forkContext?.kind === "my-decks") {
          const sourceData = user.decksData.find((data) => data.deckTemplateId === root.forkedFrom!.deckTemplateId);
          requireCondition(sourceData, "FORK_OUTSIDE_PERSONAL_CONTEXT");
          const sourceVersion = await this.getDeckVersion(sourceData.deckTemplateId, sourceData.deckTemplateVersion, session);
          requireCondition(sourceVersion, "MISSING_DECK_VERSION");
          const sourceRoot = await this.decks().findOne({ deckTemplateId: sourceData.deckTemplateId }, { session });
          requireCondition(sourceRoot, "MISSING_DECK_REFERENCE");
          assertDeckVersionAccess(actor, sourceRoot, sourceVersion);
          requireCondition(sourceData.cadenceAnchorDate === null || isIsoDateOnlyString(sourceData.cadenceAnchorDate), "INVALID_CADENCE_ANCHOR");
          let activeCardId = sourceData.activeCardId;
          if (!sourceVersion.content.cards.some((ref) => ref.cardTemplateId === activeCardId)) activeCardId = null;
          if (activeCardId && !root.draft.cards.some((ref) => ref.cardTemplateId === activeCardId)) {
            const cards = await this.cards().find({ cardTemplateId: { $in: root.draft.cards.map((ref) => ref.cardTemplateId) }, "forkedFrom.cardTemplateId": activeCardId }, { session }).toArray();
            activeCardId = cards.length === 1 ? cards[0].cardTemplateId : null;
          }
          await this.users().updateOne({ _id: userKey(actor) }, { $set: {
            "decksData.$[deck].cadenceAnchorDate": sourceData.cadenceAnchorDate,
            "decksData.$[deck].activeCardId": activeCardId,
          } }, { session, arrayFilters: [{ "deck.deckTemplateId": deckTemplateId }] });
        }
      }
    }
    await this.users().updateOne({ _id: userKey(actor), "decksData.deckTemplateId": deckTemplateId }, {
      $set: { "decksData.$[deck].deckTemplateVersion": version, "decksData.$[deck].updatedAt": now },
    }, { session, arrayFilters: [{ "deck.deckTemplateId": deckTemplateId }] }); return version;
  }
  async promoteCard(actor: string, cardTemplateId: string, expectedRevision: number) {
    // Stage an explicit promotion; only Card publication changes effective access.
    const root = await this.cards().findOne({ cardTemplateId });
    requireCondition(root?.ownerUserId === actor, "CARD_FORBIDDEN");
    const latest = root.latestVersion >= 1 ? await this.getCardVersion(cardTemplateId, root.latestVersion) : null;
    const content = root.draft ?? latest?.content;
    requireCondition(content, "MISSING_CARD_VERSION");
    return this.saveCardDraft(actor, cardTemplateId, expectedRevision, content, "public");
  }
  private async ensureDeckDataInSession(actor: string, root: DeckTemplateRoot, version: AdoptedVersion, now: Date, session: ClientSession) {
    await this.users().updateOne({ _id: userKey(actor), "decksData.deckTemplateId": { $ne: root.deckTemplateId } }, {
      $push: { decksData: { deckTemplateId: root.deckTemplateId, deckTemplateVersion: version, activeCardId: null,
        archivedAt: null, sharedWithUserIds: [], createdAt: now, updatedAt: now, openedAt: null, cadenceAnchorDate: null } },
    }, { session });
  }
  private async ensureCompositionCardData(actor: string, user: PersonalUser, refs: DeckContent["cards"], now: Date, session: ClientSession) {
    if (!refs.length) return;
    const roots = await this.cards().find({ cardTemplateId: { $in: refs.map((ref) => ref.cardTemplateId) } }, { session }).toArray();
    requireCondition(roots.length === refs.length, "MISSING_CARD_REFERENCE");
    const personal = new Map(user.cardsData.map((data) => [data.cardTemplateId, data]));
    const selected = roots.map((root) => {
      requireCondition(root.ownerUserId === actor || root.visibility === "public", "CARD_FORBIDDEN");
      const existing = personal.get(root.cardTemplateId);
      const version = existing ? existing.cardTemplateVersion : root.latestVersion;
      assertAdoption(version);
      return { cardTemplateId: root.cardTemplateId, version };
    });
    const versions = await this.cardVersions().find({ $or: selected }, { session }).toArray();
    const byId = new Map(versions.map((version) => [version.cardTemplateId, version]));
    for (const ref of refs) {
      const version = byId.get(ref.cardTemplateId);
      requireCondition(version, "MISSING_CARD_VERSION");
      assertCardVersionAccess(actor, roots.find((root) => root.cardTemplateId === ref.cardTemplateId)!, version);
      if (!personal.has(ref.cardTemplateId)) await this.users().updateOne({ _id: userKey(actor), "cardsData.cardTemplateId": { $ne: ref.cardTemplateId } }, {
        $push: { cardsData: initialCardData(ref.cardTemplateId, version.version, version.content, now) },
      }, { session });
    }
  }
  // Explicit personal entry: pin the entire adopted composition now, even when
  // the caller will not open it. Re-entry preserves adoption and reactivates it.
  async ensureDeckData(actor: string, deckTemplateId: string, version: AdoptedVersion) {
    entityId(deckTemplateId);
    assertAdoption(version);
    await this.transaction(async (session) => {
      const user = await this.assertUser(actor, session); const root = await this.decks().findOne({ deckTemplateId }, { session });
      requireCondition(root && (root.ownerUserId === actor || root.visibility === "public"), "DECK_FORBIDDEN");
      const requested = await this.getDeckVersion(deckTemplateId, version, session);
      requireCondition(requested, "MISSING_DECK_VERSION");
      assertDeckVersionAccess(actor, root, requested);
      const existing = user.decksData.find((data) => data.deckTemplateId === deckTemplateId);
      const adopted = await this.getDeckVersion(deckTemplateId, existing?.deckTemplateVersion ?? version, session);
      requireCondition(adopted, "MISSING_DECK_VERSION");
      assertDeckVersionAccess(actor, root, adopted);
      const now = new Date();
      await this.ensureCompositionCardData(actor, user, adopted.content.cards, now, session);
      if (!existing) await this.ensureDeckDataInSession(actor, root, version, now, session);
      else if (existing.archivedAt !== null) await this.users().updateOne({ _id: userKey(actor) }, {
        $set: { "decksData.$[deck].archivedAt": null, "decksData.$[deck].updatedAt": now },
      }, { session, arrayFilters: [{ "deck.deckTemplateId": deckTemplateId }] });
    });
    return (await this.getPersonalUser(actor))!.decksData.find((data) => data.deckTemplateId === deckTemplateId)!;
  }
  async ensureCardData(actor: string, cardTemplateId: string, version: AdoptedVersion, targetDate: string | null = null) {
    entityId(cardTemplateId);
    assertAdoption(version);
    await this.transaction(async (session) => {
      await this.assertUser(actor, session); const root = await this.cards().findOne({ cardTemplateId }, { session });
      requireCondition(root && (root.ownerUserId === actor || root.visibility === "public"), "CARD_FORBIDDEN");
      const adopted = await this.getCardVersion(cardTemplateId, version, session); requireCondition(adopted, "MISSING_CARD_VERSION");
      assertCardVersionAccess(actor, root, adopted);
      await this.users().updateOne({ _id: userKey(actor), "cardsData.cardTemplateId": { $ne: cardTemplateId } }, {
        $push: { cardsData: initialCardData(cardTemplateId, version, adopted.content, new Date(), targetDate) },
      }, { session });
    });
    return (await this.getPersonalUser(actor))!.cardsData.find((data) => data.cardTemplateId === cardTemplateId)!;
  }
  private async setArchive(actor: string, deckTemplateId: string, archivedAt: Date | null) {
    entityId(deckTemplateId);
    const result = await this.users().updateOne({ _id: userKey(actor), "decksData.deckTemplateId": deckTemplateId }, {
      $set: { "decksData.$[deck].archivedAt": archivedAt, "decksData.$[deck].updatedAt": new Date() },
    }, { arrayFilters: [{ "deck.deckTemplateId": deckTemplateId }] }); requireCondition(result.matchedCount === 1, "MISSING_MEMBERSHIP");
  }
  archiveDeckData(actor: string, deckTemplateId: string) { return this.setArchive(actor, deckTemplateId, new Date()); }
  reactivateDeckData(actor: string, deckTemplateId: string) { return this.setArchive(actor, deckTemplateId, null); }
  async activeMemberships(actor: string): Promise<DeckData[]> {
    const user = await this.getPersonalUser(actor); return user?.decksData.filter((deck) => deck.archivedAt === null) ?? [];
  }
  async openWorkingDeck(actor: string, deckTemplateId: string, localDate: string) {
    requireCondition(isIsoDateOnlyString(localDate) && localDate === localDate.trim(), "INVALID_CADENCE_ANCHOR");
    await this.transaction(async (session) => {
      const user = await this.assertUser(actor, session);
      const data = user.decksData.find((item) => item.deckTemplateId === deckTemplateId);
      requireCondition(data && data.archivedAt === null, "WORKING_DECK_REQUIRED");
      const root = await this.decks().findOne({ deckTemplateId }, { session });
      requireCondition(root && (root.ownerUserId === actor || root.visibility === "public"), "DECK_FORBIDDEN");
      const version = await this.getDeckVersion(deckTemplateId, data.deckTemplateVersion, session);
      requireCondition(version, "MISSING_DECK_VERSION");
      assertDeckVersionAccess(actor, root, version);
      const anchor = data.cadenceAnchorDate ?? localDate;
      const now = new Date();
      for (const [index, ref] of version.content.cards.entries()) {
        const card = await this.cards().findOne({ cardTemplateId: ref.cardTemplateId }, { session });
        requireCondition(card && (card.ownerUserId === actor || card.visibility === "public"), "CARD_FORBIDDEN");
        const existing = user.cardsData.find((item) => item.cardTemplateId === ref.cardTemplateId);
        requireCondition(existing, "MISSING_CARD_DATA");
        const adopted = await this.getCardVersion(ref.cardTemplateId, existing.cardTemplateVersion, session);
        requireCondition(adopted, "MISSING_CARD_VERSION");
        assertCardVersionAccess(actor, card, adopted);
        const generated = addDaysToDateOnly(anchor, (index + 1) * version.content.cadence.intervalDays);
        if (existing.targetDate === null) await this.users().updateOne({ _id: userKey(actor) }, {
          $set: { "cardsData.$[card].targetDate": adopted.content.suggestedTargetDate || generated, "cardsData.$[card].updatedAt": now },
        }, { session, arrayFilters: [{ "card.cardTemplateId": ref.cardTemplateId }] });
      }
      const activeCardId = version.content.cards.some((ref) => ref.cardTemplateId === data.activeCardId)
        ? data.activeCardId : version.content.cards[0]?.cardTemplateId ?? null;
      await this.users().updateOne({ _id: userKey(actor) }, { $set: {
        "decksData.$[deck].openedAt": now, "decksData.$[deck].updatedAt": now,
        "decksData.$[deck].cadenceAnchorDate": anchor, "decksData.$[deck].activeCardId": activeCardId,
      } }, { session, arrayFilters: [{ "deck.deckTemplateId": deckTemplateId }] });
    });
  }
  async setActiveCard(actor: string, deckTemplateId: string, cardTemplateId: string) {
    await this.transaction(async (session) => {
      await this.workingCard(actor, deckTemplateId, cardTemplateId, session);
      await this.users().updateOne({ _id: userKey(actor) }, { $set: { "decksData.$[deck].activeCardId": cardTemplateId,
        "decksData.$[deck].updatedAt": new Date() } }, { session, arrayFilters: [{ "deck.deckTemplateId": deckTemplateId }] });
    });
  }
  async setReflection(actor: string, deckTemplateId: string, cardTemplateId: string, reflection: string) {
    requireCondition(typeof reflection === "string" && reflection.length <= 20000, "INVALID_REFLECTION");
    await this.transaction(async (session) => {
      await this.workingCard(actor, deckTemplateId, cardTemplateId, session);
      await this.users().updateOne({ _id: userKey(actor) }, { $set: { "cardsData.$[card].reflection": reflection,
        "cardsData.$[card].updatedAt": new Date() } }, { session, arrayFilters: [{ "card.cardTemplateId": cardTemplateId }] });
    });
  }
  async mutateMedia(actor: string, deckTemplateId: string, cardTemplateId: string,
    change: { append: MediaItem } | { remove: string }, validate: (value: unknown) => MediaItem) {
    if ("remove" in change) return this.removePersonalMedia(actor, cardTemplateId, change.remove);
    return this.transaction(async (session) => {
      const { data } = await this.workingCard(actor, deckTemplateId, cardTemplateId, session);
      let mediaItems = data.mediaItems;
      requireCondition(Array.isArray(mediaItems), "INVALID_PERSONAL_MEDIA");
      const item = validate(change.append);
      const existing = mediaItems.find((media) => media?.id === item.id);
      requireCondition(!existing || isDeepStrictEqual(existing, item), "MEDIA_ID_CONFLICT");
      if (!existing) mediaItems = [...mediaItems, item];
      await this.users().updateOne({ _id: userKey(actor) }, { $set: { "cardsData.$[card].mediaItems": mediaItems,
        "cardsData.$[card].updatedAt": new Date() } }, { session, arrayFilters: [{ "card.cardTemplateId": cardTemplateId }] });
      return mediaItems;
    });
  }
  // Personal upload ownership is established by the authenticated user's own
  // CardData. Deck membership and canonical ownership do not authorize deletion.
  // Uploads still use workingCard and their existing namespace/provider checks.
  async personalMedia(actor: string, cardTemplateId: string) {
    entityId(actor); entityId(cardTemplateId);
    const user = await this.getPersonalUser(actor);
    const records = user?.cardsData?.filter((data) => data.cardTemplateId === cardTemplateId) ?? [];
    requireCondition(records.length === 1, "PERSONAL_MEDIA_FORBIDDEN");
    return readablePersonalHistory(records[0]).mediaItems;
  }
  async removePersonalMedia(actor: string, cardTemplateId: string, mediaItemId: string) {
    entityId(actor); entityId(cardTemplateId); entityId(mediaItemId);
    return this.transaction(async (session) => {
      const user = await this.getPersonalUser(actor, session);
      const records = user?.cardsData?.filter((data) => data.cardTemplateId === cardTemplateId) ?? [];
      requireCondition(records.length === 1, "PERSONAL_MEDIA_FORBIDDEN");
      requireCondition(Array.isArray(records[0].mediaItems), "INVALID_PERSONAL_MEDIA");
      await this.users().updateOne({ _id: userKey(actor) }, {
        $pull: { "cardsData.$[card].mediaItems": { id: mediaItemId } },
        $set: { "cardsData.$[card].updatedAt": new Date() },
      }, { session, arrayFilters: [{ "card.cardTemplateId": cardTemplateId }] });
      return readablePersonalHistory({ ...records[0], mediaItems: records[0].mediaItems.filter((item) => item?.id !== mediaItemId) }).mediaItems;
    });
  }
  private async workingCard(actor: string, deckTemplateId: string, cardTemplateId: string, session: ClientSession) {
    const user = await this.assertUser(actor, session);
    const membership = user.decksData.find((data) => data.deckTemplateId === deckTemplateId);
    requireCondition(membership && membership.archivedAt === null, "WORKING_DECK_REQUIRED");
    const deck = await this.decks().findOne({ deckTemplateId }, { session });
    requireCondition(deck && (deck.ownerUserId === actor || deck.visibility === "public"), "DECK_FORBIDDEN");
    const version = await this.getDeckVersion(deckTemplateId, membership.deckTemplateVersion, session);
    requireCondition(version, "MISSING_DECK_VERSION");
    assertDeckVersionAccess(actor, deck, version);
    requireCondition(version.content.cards.some((ref) => ref.cardTemplateId === cardTemplateId), "CARD_OUTSIDE_WORKING_CONTEXT");
    const root = await this.cards().findOne({ cardTemplateId }, { session });
    requireCondition(root && (root.ownerUserId === actor || root.visibility === "public"), "CARD_FORBIDDEN");
    const data = user.cardsData.find((card) => card.cardTemplateId === cardTemplateId);
    requireCondition(data, "MISSING_CARD_DATA");
    const cardVersion = await this.getCardVersion(cardTemplateId, data.cardTemplateVersion, session);
    requireCondition(cardVersion, "MISSING_CARD_VERSION");
    assertCardVersionAccess(actor, root, cardVersion);
    return { data, cardVersion };
  }
  async setCompletion(actor: string, deckTemplateId: string, cardTemplateId: string, stepId: string, completionStatus: CompletionStatus) {
    requireCondition(["todo", "inProgress", "done", "skipped"].includes(completionStatus), "INVALID_COMPLETION");
    await this.transaction(async (session) => {
      const { data, cardVersion } = await this.workingCard(actor, deckTemplateId, cardTemplateId, session);
      requireCondition(cardVersion.content.steps.some((step) => step.stepId === stepId), "STEP_OUTSIDE_ADOPTED_CARD");
      if (!data.items.some((item) => item.stepId === stepId)) {
        await this.users().updateOne({ _id: userKey(actor) }, { $push: { "cardsData.$[card].items": { stepId, completionStatus } }, $set: { "cardsData.$[card].updatedAt": new Date() } },
          { session, arrayFilters: [{ "card.cardTemplateId": cardTemplateId }] }); return;
      }
      const result = await this.users().updateOne({ _id: userKey(actor) }, { $set: {
        "cardsData.$[card].items.$[step].completionStatus": completionStatus, "cardsData.$[card].updatedAt": new Date(),
      } }, { session, arrayFilters: [{ "card.cardTemplateId": cardTemplateId }, { "step.stepId": stepId }] });
      requireCondition(result.matchedCount === 1, "MISSING_CARD_DATA");
    });
  }
  async setSignalReading(actor: string, deckTemplateId: string, cardTemplateId: string, stepId: string, reading: number | null) {
    requireCondition(reading === null || (typeof reading === "number" && Number.isFinite(reading) && reading >= 1 && reading <= 10), "INVALID_SIGNAL_READING");
    await this.transaction(async (session) => {
      const { data, cardVersion } = await this.workingCard(actor, deckTemplateId, cardTemplateId, session);
      requireCondition(cardVersion.content.steps.some((step) => step.stepId === stepId), "STEP_OUTSIDE_ADOPTED_CARD");
      if (!data.signalReadings.some((item) => item.stepId === stepId)) {
        await this.users().updateOne({ _id: userKey(actor) }, { $push: { "cardsData.$[card].signalReadings": { stepId, reading } }, $set: { "cardsData.$[card].updatedAt": new Date() } },
          { session, arrayFilters: [{ "card.cardTemplateId": cardTemplateId }] }); return;
      }
      await this.users().updateOne({ _id: userKey(actor) }, { $set: {
        "cardsData.$[card].signalReadings.$[step].reading": reading, "cardsData.$[card].updatedAt": new Date(),
      } }, { session, arrayFilters: [{ "card.cardTemplateId": cardTemplateId }, { "step.stepId": stepId }] });
    });
  }
  async setTargetDate(actor: string, deckTemplateId: string, cardTemplateId: string, targetDate: string | null) {
    requireCondition(targetDate === null || isIsoDateOnlyString(targetDate), "INVALID_TARGET_DATE");
    await this.transaction(async (session) => {
      await this.workingCard(actor, deckTemplateId, cardTemplateId, session);
      await this.users().updateOne({ _id: userKey(actor) }, { $set: { "cardsData.$[card].targetDate": targetDate, "cardsData.$[card].updatedAt": new Date() } },
        { session, arrayFilters: [{ "card.cardTemplateId": cardTemplateId }] });
    });
  }
  async moveConstructionStep(actor: string, deckTemplateId: string, sourceId: string, destinationId: string, sourceIndex: number, destinationIndex: number,
    revisions: { deck: number; source: number; destination: number }) {
    return this.transaction(async (session) => {
      const deck = await this.ownerDeck(actor, deckTemplateId, revisions.deck, session);
      const source = await this.ownerCard(actor, sourceId, revisions.source, session);
      const destination = await this.ownerCard(actor, destinationId, revisions.destination, session);
      requireCondition(deck.draft?.cards.some((ref) => ref.cardTemplateId === sourceId) && deck.draft.cards.some((ref) => ref.cardTemplateId === destinationId), "CARD_OUTSIDE_DECK");
      const ids = [sourceId, destinationId];
      requireCondition(!await this.decks().findOne({ deckTemplateId: { $ne: deckTemplateId }, "draft.cards.cardTemplateId": { $in: ids } }, { session })
        && !await this.deckVersions().findOne({ deckTemplateId: { $ne: deckTemplateId }, "content.cards.cardTemplateId": { $in: ids } }, { session }), "CROSS_CARD_MOVE_AFTER_REUSE");
      const moved = swapConstructionSteps(source, destination, deck, sourceIndex, destinationIndex);
      const sourceStepId = source.draft!.steps[sourceIndex].stepId;
      const destinationStepId = destination.draft!.steps[destinationIndex].stepId;
      const sourceStepIds = [...new Set([...source.stepIds.filter((id) => id !== sourceStepId), destinationStepId])];
      const destinationStepIds = [...new Set([...destination.stepIds.filter((id) => id !== destinationStepId), sourceStepId])];
      // Release both never-published reservations before transferring identities atomically.
      await this.cards().updateMany({ cardTemplateId: { $in: [sourceId, destinationId] } }, { $set: { stepIds: [] } }, { session });
      await this.cards().updateOne({ cardTemplateId: sourceId }, { $set: { draft: moved.source, stepIds: sourceStepIds, updatedAt: new Date() }, $inc: { revision: 1 } }, { session });
      await this.cards().updateOne({ cardTemplateId: destinationId }, { $set: { draft: moved.destination, stepIds: destinationStepIds, updatedAt: new Date() }, $inc: { revision: 1 } }, { session });
      await this.decks().updateOne({ deckTemplateId }, { $inc: { revision: 1 } }, { session });
      // No personal completion/signal transfer. Normally no CardData exists during construction.
      return moved;
    });
  }
}
